const path = require('node:path');
const express = require('express');

/**
 * 문서 내용을 업로드받지 않고 src 폴더의 화면과 정적 파일만 제공하는 앱을 만든다.
 * @returns {import('express').Express} 정적 파일 제공 설정을 마친 Express 앱
 */
function createApp() {
    const app = express();
    app.disable('x-powered-by');
    // 브라우저가 파일 형식을 임의로 추측하지 않게 한다.
    app.use((request, response, next) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        next();
    });
    app.use(express.static(path.join(__dirname, 'src')));
    return app;
}

if (require.main === module) {
    /** 서버가 들을 포트다. PORT 환경 변수가 없으면 기본 포트를 사용한다. */
    const port = Number(process.env.PORT || 9803);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('PORT는 1부터 65535 사이의 정수여야 합니다.');
        process.exitCode = 1;
    } else {
        createApp().listen(port, () => {
            console.log(`Markdown Tool 실행: http://localhost:${port}`);
        }).on('error', (error) => {
            console.error(`서버를 실행하지 못했습니다: ${error.message}`);
            process.exitCode = 1;
        });
    }
}

module.exports = { createApp };

