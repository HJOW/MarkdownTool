const { defineConfig, devices } = require('@playwright/test');

/** 실제 Chromium에서 화면 기능을 확인하는 검사 설정이다. */
module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    expect: { timeout: 10000 },
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:9804',
        // 편집기에 원문을 그대로 붙여넣어 준비하려면 클립보드 권한이 필요하다.
        permissions: ['clipboard-read', 'clipboard-write'],
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node index.js',
        url: 'http://127.0.0.1:9804',
        env: { PORT: '9804' },
        reuseExistingServer: false
    }
});
