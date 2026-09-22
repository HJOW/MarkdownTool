const path = require('node:path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/** 문서 저장용 CSS는 화면 CSS와 달리 JavaScript 문자열로 가져온다. */
const documentStylesPath = path.resolve(__dirname, 'src/css/document.css');

/**
 * 웹 화면 JavaScript를 mdtool.js 하나로 묶는다.
 * Mermaid, PDF, 글꼴 포함 기능의 import()도 eager 모드로 처리해 별도 청크를 만들지 않는다.
 * Monaco 작업자는 worker-loader가 Blob에 넣으므로 별도 작업자 파일도 만들지 않는다.
 */
module.exports = {
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    entry: path.resolve(__dirname, 'src/js/mdtool.js'),
    target: 'web',
    devtool: false,
    output: {
        path: path.resolve(__dirname, 'src/dist'),
        filename: 'mdtool.js',
        clean: true,
        publicPath: ''
    },
    optimization: {
        splitChunks: false,
        runtimeChunk: false
    },
    module: {
        parser: {
            javascript: {
                dynamicImportMode: 'eager'
            }
        },
        rules: [
            // package.json은 Node 서버를 위해 CommonJS지만, 화면 소스는 ESM으로 작성했다.
            {
                test: /\.js$/,
                include: path.resolve(__dirname, 'src/js'),
                type: 'javascript/esm'
            },
            {
                test: /editor\.worker\.js$/,
                use: {
                    loader: 'worker-loader',
                    options: { inline: 'no-fallback' }
                }
            },
            // Monaco가 대체 경로로 쓰는 작업자 URL도 자료 URL로 넣어 별도 .js 파일을 만들지 않는다.
            {
                test: /editorWebWorkerMain\.js$/,
                type: 'asset/inline'
            },
            {
                test: /document\.css$/,
                include: documentStylesPath,
                type: 'asset/source'
            },
            {
                test: /\.css$/,
                exclude: documentStylesPath,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            },
            {
                // 수식 CSS가 제공하는 모든 글꼴 형식도 독립 파일 없이 메인 번들 문자열에 넣는다.
                test: /\.(woff2?|ttf)$/,
                type: 'asset/inline'
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: 'mdtool.css' })
    ],
    performance: {
        hints: false
    }
};
