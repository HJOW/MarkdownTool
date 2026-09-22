const js = require('@eslint/js');
const globals = require('globals');

/** Node.js 서버·설정 파일과 브라우저 프로그램을 각각의 실행 환경으로 검사한다. */
module.exports = [
    {
        ignores: ['node_modules/**', 'src/dist/**', 'playwright-report/**', 'test-results/**']
    },
    {
        files: ['*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-console': 'off'
        }
    },
    {
        files: ['src/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.worker,
                MATH_STYLES: 'readonly'
            }
        },
        rules: js.configs.recommended.rules
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.browser,
                test: 'readonly',
                expect: 'readonly'
            }
        },
        rules: js.configs.recommended.rules
    }
];
