// Markdown 원문 편집에 사용하는 Monaco 편집기 설정이다.
// 편집 기능은 기본 화면에서 바로 필요하므로 정적으로 가져오되, 필요한 기여 모듈만 골라 번들 크기를 억제한다.
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker';
import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-editor/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/contrib/placeholderText/browser/placeholderText.contribution.js';
import 'monaco-editor/editor/contrib/readOnlyMessage/browser/contribution.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/features/find/register.js';
import 'monaco-editor/features/codicon/register.js';
// Markdown 문법 강조 규칙도 단일 번들 안에 함께 넣는다.
import 'monaco-editor/languages/definitions/markdown/register.js';

/** 화면 테마에 맞추어 다시 정의하는 편집기 테마 이름이다. */
const THEME_NAME = 'mdtool';

/** Monaco 작업자를 메인 번들 안의 Blob으로 만들어 별도 JavaScript 파일 요청을 없앤다. */
self.MonacoEnvironment = {
    /**
     * 편집기 작업자를 만든다.
     * @returns {Worker} webpack이 메인 번들에 포함한 작업자
     */
    getWorker() {
        return new EditorWorker();
    }
};

/**
 * 편집기 색을 화면 테마의 CSS 변수와 같은 값으로 맞춘 뒤 적용한다.
 * @param {'light'|'dark'} theme 현재 화면 테마
 * @returns {void}
 */
function defineTheme(theme) {
    const styles = getComputedStyle(document.documentElement);
    /**
     * 화면에 적용된 CSS 변수 값을 읽는다.
     * @param {string} name CSS 변수 이름
     * @returns {string} 색 표기 문자열
     */
    const color = (name) => styles.getPropertyValue(name).trim();
    monaco.editor.defineTheme(THEME_NAME, {
        base: theme === 'dark' ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': color('--surface'),
            'editor.foreground': color('--text'),
            'editorCursor.foreground': color('--accent'),
            'editorLineNumber.foreground': color('--muted'),
            'editorLineNumber.activeForeground': color('--accent'),
            'editorIndentGuide.background1': color('--border'),
            'editor.lineHighlightBackground': color('--hover'),
            'editorWidget.background': color('--surface'),
            'editorWidget.border': color('--border')
        }
    });
    monaco.editor.setTheme(THEME_NAME);
}

/**
 * 지정한 요소에 Markdown 원문 편집기를 만든다.
 * 줄번호와 문법 강조는 Monaco가 직접 표시하므로 화면에 별도 줄번호를 두지 않는다.
 * @param {object} options 편집기 설정
 * @param {HTMLElement} options.host 편집기를 붙일 요소
 * @param {string} options.ariaLabel 보조 기술에 알릴 편집 영역 이름
 * @param {string} options.placeholder 문서가 비어 있을 때 보여 줄 안내 문구
 * @param {() => void} options.onChange 원문이 바뀔 때마다 부를 함수
 * @returns {{
 *     setDocument: (source: string) => void,
 *     getText: () => string,
 *     setReadOnly: (readOnly: boolean) => void,
 *     applyTheme: (theme: 'light'|'dark') => void,
 *     focus: () => void,
 *     layout: () => void
 * }} 문서와 화면 상태를 다루는 편집기 조작 함수 모음
 */
export function createSourceEditor({ host, ariaLabel, placeholder, onChange }) {
    const editor = monaco.editor.create(host, {
        value: '',
        language: 'markdown',
        automaticLayout: true,
        ariaLabel,
        placeholder,
        fontFamily: "'D2Coding', monospace",
        fontSize: 14,
        lineHeight: 24,
        fontLigatures: false,
        padding: { top: 24, bottom: 24 },
        lineNumbersMinChars: 3,
        renderLineHighlightOnlyWhenFocus: true,
        // 기존 편집 방식을 유지하기 위해 줄바꿈 없이 가로로 넘기고 입력을 임의로 보완하지 않는다.
        wordWrap: 'off',
        wrappingIndent: 'none',
        autoClosingBrackets: 'never',
        autoClosingQuotes: 'never',
        autoSurround: 'never',
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: false,
        trimAutoWhitespace: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        overviewRulerLanes: 0,
        renderWhitespace: 'none',
        occurrencesHighlight: 'off',
        matchBrackets: 'near',
        contextmenu: true
    });
    editor.onDidChangeModelContent(() => onChange());
    // 글꼴 파일을 늦게 받아도 글자 너비 계산이 어긋나지 않게 다시 측정한다.
    document.fonts.ready.then(() => monaco.editor.remeasureFonts()).catch(() => { /* 글꼴 상태를 알 수 없으면 기본 측정값을 유지한다. */ });

    return {
        /**
         * 문서를 교체한다. 되돌리기 기록이 이전 문서로 넘어가지 않도록 모델을 새로 만든다.
         * @param {string} source 새 문서의 Markdown 원문
         * @returns {void}
         */
        setDocument(source) {
            const previous = editor.getModel();
            editor.setModel(monaco.editor.createModel(source.replace(/\r\n|\r/g, '\n'), 'markdown'));
            previous?.dispose();
        },
        /**
         * 편집 중인 원문을 읽는다. 저장과 통계에서 쓰는 규칙에 맞추어 항상 LF로 돌려준다.
         * @returns {string} 편집기에 있는 Markdown 원문
         */
        getText() {
            return editor.getModel().getValue(monaco.editor.EndOfLinePreference.LF);
        },
        /**
         * 편집 가능 여부를 바꾼다. 화면에서도 배경색으로 구분할 수 있게 표시를 남긴다.
         * @param {boolean} readOnly 읽기 전용으로 둘지 여부
         * @returns {void}
         */
        setReadOnly(readOnly) {
            editor.updateOptions({ readOnly });
            host.dataset.readonly = String(readOnly);
        },
        /**
         * 편집기 색을 현재 화면 테마에 맞춘다.
         * @param {'light'|'dark'} theme 적용할 테마
         * @returns {void}
         */
        applyTheme(theme) {
            defineTheme(theme);
        },
        /**
         * 편집기에 입력 초점을 준다.
         * @returns {void}
         */
        focus() {
            editor.focus();
        },
        /**
         * 편집기 크기를 지금 보이는 영역에 맞춘다.
         * @returns {void}
         */
        layout() {
            editor.layout();
        }
    };
}
