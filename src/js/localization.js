/** 화면에서 지원하는 언어와 번역 문구다. 영어는 알 수 없는 언어의 기본값으로 사용한다. */
const TRANSLATIONS = {
    en: {
        fileActions: 'File actions',
        newDocument: 'New',
        openFile: 'Open file',
        save: 'Save',
        print: 'Print',
        screenMode: 'View mode',
        edit: 'Edit',
        view: 'Preview',
        split: 'Side by side',
        modified: 'Modified',
        editable: 'Editable',
        readOnly: 'Read only',
        previewHeading: 'HTML preview',
        previewTitle: 'Markdown document preview',
        documentInfo: 'Document information',
        language: 'Language',
        darkMode: 'Dark mode',
        lightMode: 'Light mode',
        saveTitle: 'Save document',
        saveDescription: 'Choose a download format and its options.',
        markdownSaveDescription: 'Save the source and continue editing',
        htmlSaveDescription: 'Save as a formatted web document',
        pdfSaveDescription: 'Save as an A4 document for printing and sharing',
        embedFonts: 'Embed fonts',
        embedFontsDescription: 'Clear this option to load fonts from a CDN.',
        pdfTheme: 'PDF theme',
        pdfThemeDescription: 'This choice only affects the saved PDF, not the current screen or preview.',
        lightTheme: 'Light theme',
        darkTheme: 'Dark theme',
        cancel: 'Cancel',
        downloadFile: 'Download file',
        javascriptRequired: 'Enable JavaScript in your browser to use this tool.',
        editorAriaLabel: 'Markdown source',
        editorPlaceholder: 'Write a new document in Markdown.',
        lineCountOne: '{count} line',
        lineCount: '{count} lines',
        byteTitle: 'Byte size when the Markdown is saved as UTF-8',
        alertNote: 'Note',
        alertTip: 'Tip',
        alertImportant: 'Important',
        alertWarning: 'Warning',
        alertCaution: 'Caution',
        diagramError: 'Could not render the diagram. Check the Mermaid syntax.',
        previewError: 'Could not create the preview. The source has been preserved.',
        discardConfirm: 'You have unsaved changes. Discard them and continue?',
        invalidExtension: 'Choose a Markdown file with a .md or .markdown extension.',
        fileLoaded: 'The file has been opened.',
        fileReadError: 'Could not read the file. Make sure it is a UTF-8 Markdown file.',
        printBlocked: 'The print window was blocked. Allow pop-ups for this site and try again.',
        printPreparingTitle: '{filename} — Preparing to print',
        printPreparing: 'Preparing the document for printing…',
        printOpened: 'The browser print dialog has been opened.',
        printError: 'Could not create the print document. Try again.',
        savePreparing: 'Preparing the download…',
        downloadRequested: 'Requested download of {filename}.',
        saveError: 'Could not create the file. Try again.',
        newCreated: 'A new document has been created.'
    },
    ko: {
        fileActions: '파일 작업',
        newDocument: '새로 만들기',
        openFile: '파일 불러오기',
        save: '저장',
        print: '인쇄',
        screenMode: '화면 모드',
        edit: '편집',
        view: '보기',
        split: '같이 보기',
        modified: '수정됨',
        editable: '편집 가능',
        readOnly: '읽기 전용',
        previewHeading: 'HTML 미리보기',
        previewTitle: 'Markdown 문서 미리보기',
        documentInfo: '문서 정보',
        language: '언어',
        darkMode: '다크 모드',
        lightMode: '밝기 모드',
        saveTitle: '문서 저장',
        saveDescription: '다운로드할 형식과 옵션을 선택하세요.',
        markdownSaveDescription: '원문을 저장하여 계속 편집하기',
        htmlSaveDescription: '서식이 적용된 웹 문서로 저장하기',
        pdfSaveDescription: '인쇄와 공유용 A4 문서로 저장하기',
        embedFonts: '글꼴 포함',
        embedFontsDescription: '해제하면 CDN에서 글꼴을 불러옵니다.',
        pdfTheme: 'PDF 테마',
        pdfThemeDescription: '이 선택은 저장할 PDF에만 적용되며, 현재 화면과 미리보기 테마는 바꾸지 않습니다.',
        lightTheme: '밝기 모드',
        darkTheme: '다크 모드',
        cancel: '취소',
        downloadFile: '파일 다운로드',
        javascriptRequired: '이 도구를 사용하려면 브라우저에서 JavaScript를 허용해 주세요.',
        editorAriaLabel: 'Markdown 원문',
        editorPlaceholder: 'Markdown으로 새로운 문서를 작성해 보세요.',
        lineCountOne: '{count}줄',
        lineCount: '{count}줄',
        byteTitle: 'UTF-8로 Markdown을 저장할 때의 바이트 수',
        alertNote: '참고',
        alertTip: '팁',
        alertImportant: '중요',
        alertWarning: '주의',
        alertCaution: '경고',
        diagramError: '다이어그램을 표시하지 못했습니다. Mermaid 문법을 확인해 주세요.',
        previewError: '미리보기를 만들지 못했습니다. 원문은 그대로 보존되어 있습니다.',
        discardConfirm: '저장하지 않은 변경 사항이 있습니다. 내용을 버리고 계속할까요?',
        invalidExtension: 'Markdown 파일(.md 또는 .markdown)을 선택해 주세요.',
        fileLoaded: '파일을 불러왔습니다.',
        fileReadError: '파일을 읽지 못했습니다. UTF-8로 저장된 Markdown 파일인지 확인해 주세요.',
        printBlocked: '인쇄 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.',
        printPreparingTitle: '{filename} 인쇄 준비',
        printPreparing: '인쇄용 문서를 준비하고 있습니다…',
        printOpened: '브라우저 인쇄 창을 열었습니다.',
        printError: '인쇄용 문서를 만들지 못했습니다. 다시 시도해 주세요.',
        savePreparing: '다운로드를 준비하고 있습니다…',
        downloadRequested: '{filename} 다운로드를 요청했습니다.',
        saveError: '저장 파일을 만들지 못했습니다. 다시 시도해 주세요.',
        newCreated: '새 문서를 만들었습니다.'
    }
};

/**
 * 브라우저 언어 목록에서 지원 언어를 고른다. 한국어가 아니면 영어를 기본값으로 사용한다.
 * @param {readonly string[]} languages 브라우저가 선호하는 언어 목록
 * @returns {'en'|'ko'} 선택한 화면 언어
 */
export function detectLanguage(languages = navigator.languages) {
    return [...languages].some((language) => /^ko(?:-|$)/i.test(language)) ? 'ko' : 'en';
}

/**
 * 지원 여부를 확인하여 안전한 화면 언어 값을 돌려준다.
 * @param {unknown} language 확인할 값
 * @returns {'en'|'ko'} 지원하는 화면 언어
 */
export function normalizeLanguage(language) {
    return language === 'ko' ? 'ko' : 'en';
}

/**
 * 선택한 언어의 문구를 읽고 중괄호 자리표시자를 값으로 바꾼다.
 * @param {'en'|'ko'} language 화면 언어
 * @param {string} key 번역 문구 키
 * @param {Record<string, string|number>} [parameters] 자리표시자에 넣을 값
 * @returns {string} 완성한 문구
 */
export function translate(language, key, parameters = {}) {
    const template = TRANSLATIONS[normalizeLanguage(language)][key] ?? TRANSLATIONS.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => String(parameters[name] ?? match));
}
