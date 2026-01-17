const path = require('path');

// Output to comfy_3d_viewers/web/js directory (package structure)
const OUTPUT_DIR = path.resolve(__dirname, '../comfy_3d_viewers/web/js');

module.exports = [
    // VTK.js bundle with GLTF support
    {
        entry: './vtk_gltf_bundle.js',
        output: {
            filename: 'vtk-gltf.js',
            path: OUTPUT_DIR,
            library: {
                name: 'vtk',
                type: 'umd',
                export: 'default',
            },
            globalObject: 'globalThis',
        },
        mode: 'production',
        resolve: {
            extensions: ['.js'],
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                        },
                    },
                },
            ],
        },
        // Optimize for size
        optimization: {
            minimize: true,
        },
    },
    // Modular viewer bundle
    {
        entry: path.resolve(__dirname, '../comfy_3d_viewers/web/js/viewer/index.js'),
        output: {
            filename: 'viewer-bundle.js',
            path: OUTPUT_DIR,
            library: {
                name: 'GeomPackViewer',
                type: 'umd',
            },
            globalObject: 'globalThis',
        },
        mode: 'production',
        resolve: {
            extensions: ['.js'],
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                        },
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
            ],
        },
        optimization: {
            minimize: true,
        },
    },
];
