import "@babylonjs/loaders/glTF/2.0";
import {
    AbstractMesh,
    AnimationGroup,
    Engine,
    Scene,
    SceneLoader,
    Vector3,
    Camera,
    Color4,
    DracoCompression,
} from "@babylonjs/core";

// TODO: Enable this for the inspector
//import "@babylonjs/core/Debug/debugLayer";
//import "@babylonjs/inspector";

// TODO: copy the Draco loader files into the webroot
/*DracoCompression.Configuration = {
    decoder: {
        wasmUrl: "/draco_wasm_wrapper_gltf.js",
        wasmBinaryUrl: "/draco_decoder_gltf.wasm",
        fallbackUrl: "/draco_decoder_gltf.js",
    },
}*/

// Check if the current device has a potato as a GPU, or the user prefers reduced motion (accessibility).
// Disable animations if so.
let noAnimations = false
let lowPerformance = false
if (Engine.HasMajorPerformanceCaveat) {
    noAnimations = true
    lowPerformance = true
    console.log("Major performance caveat detected, disabling animations and high quality rendering.")
} else {
    lowPerformance = false
    // These media queries are not widely supported, but we should be good netizens and do our best.
    noAnimations = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches ||
        window.matchMedia(`(update: slow)`).matches ||
        window.matchMedia(`(update: none)`).matches
    if (noAnimations) {
        console.log("User requested reduced motion, disabling animations.")
    }
}

// Get the render canvas element from the HTML.
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
// Initialize the BabylonJS engine.
const engine = new Engine(
    canvas,
    // Disable antialiasing if the device has a low performance.
    !lowPerformance,
    {
        antialias: !lowPerformance,
        audioEngine: false,
    },
    // Disable high DPI view if the device has a low performance.
    !lowPerformance
);
const scene = new Scene(engine);

// This variable stores the current page we are on.
let currentPage = ""
const content = document.getElementById("content")
let playingAnimation: AnimationGroup = null
let xhrInProgress: XMLHttpRequest = null

// The navigate function will load the content for the corresponding page from the server side
// and play the transition animation.
function navigate(to: string) {
    let targetPage = ""
    switch (to) {
        case "/":
            targetPage = "start"
            break
        case "/blog/":
            targetPage = "blog"
            break
        case "/contact/":
            targetPage = "contact"
            break
    }

    let readyCount = 0
    content.classList.remove("content--display")
    function ready() {
        readyCount++
        // Only reveal the content if both the animation have finished and the content is available.
        if (readyCount != 2) {
            return
        }
        currentPage = targetPage
        setTimeout(function () {
            // Wait for the mesh to settle
            const meshArea = getMeshVisibleArea(currentPage)
            if (meshArea[2] > 0) {
                content.style.left = meshArea[0] + "px"
                content.style.top = meshArea[1] + "px"
                content.style.width = meshArea[2] - meshArea[0] + "px"
                content.style.height = meshArea[3] - meshArea[1] + "px"
                content.classList.add("content--display")
            }
        }, 100)
    }

    // Load page from server
    const xhr = new XMLHttpRequest()
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            // Parse the HTML and extract the content
            const doc = (new DOMParser()).parseFromString(xhr.responseText, "text/html")
            content.innerHTML = doc.getElementById("content").innerHTML
            updateLinks(content)
            // Call the ready hook to reveal the content.
            ready()
        }
    }
    xhr.open("GET", to)
    xhr.send()

    // If an XHR is in progress, abort it.
    if (xhrInProgress != null) {
        xhrInProgress.abort()
    }
    xhrInProgress = xhr

    // Play transition animation
    const animation = currentPage + "_to_" + targetPage
    const animationGroup = scene.getAnimationGroupByName(animation)
    if (noAnimations) {
        // If no animations are desired, jump to last frame.
        animationGroup.goToFrame(animationGroup.to)
    } else {
        animationGroup.goToFrame(animationGroup.from)
    }
    if (playingAnimation !== null) {
        playingAnimation.stop()
        playingAnimation.reset()
    }
    animationGroup.onAnimationEndObservable.addOnce(function () {
        ready()
    })
    animationGroup.play(false)
    playingAnimation = animationGroup
}

// This function replaces all links with their animated counterparts.
function updateLinks(element: HTMLElement) {
    for (let link of element.getElementsByTagName("a")) {
        if (link.getAttribute("href").startsWith("/")) {
            // Hijack the link click.
            link.addEventListener("click", function (e) {
                // Prevent the default behavior.
                e.preventDefault()
                e.stopPropagation()

                // Animate and load the content.
                navigate(link.getAttribute("href"))

                // Record the history entry.
                window.history.pushState(null, undefined, link.href)
            })
        }
    }
}

function getMeshVisibleArea(name: string): [number,number,number,number] {
    const meshes = scene.getActiveMeshes().data.filter((mesh: AbstractMesh) => mesh.name.startsWith(name))
    if (meshes.length == 0) {
        return [0,0,0,0]
    }
    const mesh = meshes[meshes.length - 1]
    const meshVectors = mesh.getBoundingInfo()?.boundingBox?.vectors
    const worldMatrix = mesh.getWorldMatrix()
    const transformMatrix = scene.getTransformMatrix.apply(scene)
    const viewport = scene.activeCamera?.viewport
    const coordinates = meshVectors.map((v: Vector3) => {
        const projection = Vector3.Project(v, worldMatrix, transformMatrix, viewport)
        projection.x = projection.x * canvas.clientWidth
        projection.y = projection.y * canvas.clientHeight
        return projection
    })
    let minX = canvas.clientWidth
    let maxX = 0
    let minY = canvas.clientHeight
    let maxY = 0
    for (let coordinate of coordinates) {
        if (minX > coordinate.x) {
            minX = coordinate.x
        }
        if (maxX < coordinate.x) {
            maxX = coordinate.x
        }
        if (minY > coordinate.y) {
            minY = coordinate.y
        }
        if (maxY < coordinate.y) {
            maxY = coordinate.y
        }
    }
    return [
        minX,
        minY,
        maxX,
        maxY
    ]
}

// If the user clicks the back button, do an animated transition instead.
window.addEventListener("popstate", function (event) {
    // Prevent the default behavior.
    event.preventDefault()
    event.stopPropagation()

    // Animate and load content.
    navigate(window.location.pathname)
})

// The scene loader will load our GLB file.
SceneLoader.Append(
    "/",
    "room.glb",
    scene,
    (scene) => {
        scene.clearColor = Color4.FromHexString("#000000")

        // Stop all animations from playing.
        for (let animation of scene.animationGroups) {
            animation.stop()
            animation.reset()
        }

        // Set the imported camera to be active.
        scene.activeCamera = scene.cameras[0]
        scene.activeCamera.fovMode = Camera.FOVMODE_VERTICAL_FIXED

        // Update the existing links in the body.
        updateLinks(document.body)

        // Navigate to the current path. Note: this will cause an extra HTTP request to the server
        // which could be optimized away.
        navigate(window.location.pathname)

        // Start the render loop
        engine.runRenderLoop(function () {
            scene.render();
        })
    },
)
