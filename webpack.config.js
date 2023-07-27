const path = require('path')

module.exports = {
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
            },
        ],
    },
    entry: './src/index.ts',
    mode: 'development',
    // Disable performance hints, we have a custom loader
    performance: {
        hints: false,
        maxAssetSize: 10000000,
        maxEntrypointSize: 10000000
    },
    // Pack everything into website.js
    output: {
        filename: 'website.js',
        path: path.join(__dirname, "dist")
    },
    // Serve static files.
    devServer: {
        static: {
            directory: path.join(__dirname, 'static'),
        },
        compress: true,
        port: 9000,
    },
};
