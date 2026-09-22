import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import GithubSlugger from 'github-slugger';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import documentStyles from '../css/document.css';
import { createSourceEditor } from './markdown-editor.js';

// MATH_STYLES는 webpack이 넣어 주는 수식 서식 CSS다. 글꼴 자료까지 담아 저장본에서도 수식이 그대로 보인다.

/**
 * HTML에서 뜻이 달라지는 글자를 안전한 표기로 바꾼다.
 * @param {unknown} value 원래 값
 * @returns {string} HTML에 그대로 넣을 수 있는 문자열
 */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

/** 미리보기와 저장본이 함께 쓰는 Markdown 변환기다. */
const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    /**
     * 코드 블록의 구문을 강조한다.
     * @param {string} code 코드 블록 내용
     * @param {string} language 코드 블록에 적힌 언어 이름
     * @returns {string} 강조를 적용한 HTML
     */
    highlight(code, language) {
        if (language && hljs.getLanguage(language)) {
            return hljs.highlight(code, { language, ignoreIllegals: true }).value;
        }
        return escapeHtml(code);
    }
}).use(footnote).use(taskLists, { enabled: false }).use(emoji);

/** 미리보기가 불러오는 문서 서식 파일의 주소다. */
const documentStylesheet = new URL('css/document.css', window.location.href).href;

/** 글꼴 포함을 해제한 HTML 저장본이 참조하는 고정 판 글꼴 주소다. */
const D2CODING_CDN_FONTS = {
    regular: 'https://cdn.jsdelivr.net/npm/d2coding@1.3.2/fonts/d2coding-full.woff2',
    bold: 'https://cdn.jsdelivr.net/npm/d2coding@1.3.2/fonts/d2coding-bold-full.woff2'
};

// Markdown 표의 정렬을 보존하면서 원문 HTML의 임의 스타일은 차단한다.
for (const type of ['th_open', 'td_open']) {
    /**
     * 표 칸의 정렬을 스타일 대신 align 속성으로 옮긴다.
     * @param {object[]} tokens 변환 중인 토큰 목록
     * @param {number} index 지금 처리하는 토큰 위치
     * @param {object} options Markdown 변환 설정
     * @param {object} environment 이번 변환에서 함께 쓰는 값 모음
     * @param {object} renderer Markdown 출력기
     * @returns {string} 표 칸 시작 태그
     */
    markdown.renderer.rules[type] = (tokens, index, options, environment, renderer) => {
        const token = tokens[index];
        const alignment = token.attrGet('style')?.match(/^text-align:(left|center|right)$/)?.[1];
        if (alignment) token.attrSet('align', alignment);
        return renderer.renderToken(tokens, index, options);
    };
}

/**
 * GitHub의 알림 상자를 토큰 단계에서 처리하여 코드 블록을 보존한다.
 * @param {object} state Markdown 변환 상태
 * @returns {void}
 */
markdown.core.ruler.before('inline', 'github_alerts', (state) => {
    for (let index = 0; index < state.tokens.length; index += 1) {
        const opening = state.tokens[index];
        const content = state.tokens[index + 2];
        if (opening.type !== 'blockquote_open' || state.tokens[index + 1]?.type !== 'paragraph_open' || content?.type !== 'inline') continue;
        const match = content.content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/);
        if (!match) continue;
        let depth = 1;
        for (let end = index + 1; end < state.tokens.length; end += 1) {
            if (state.tokens[end].type === 'blockquote_open') depth += 1;
            if (state.tokens[end].type === 'blockquote_close') depth -= 1;
            if (depth === 0) {
                opening.type = 'alert_open';
                opening.meta = { kind: match[1] };
                state.tokens[end].type = 'alert_close';
                content.content = content.content.slice(match[0].length);
                break;
            }
        }
    }
});
/**
 * 알림 상자의 시작 태그와 종류별 제목을 만든다.
 * @param {object[]} tokens 변환 중인 토큰 목록
 * @param {number} index 지금 처리하는 토큰 위치
 * @returns {string} 알림 상자 시작 HTML
 */
markdown.renderer.rules.alert_open = (tokens, index) => {
    const kind = tokens[index].meta.kind;
    const titles = { NOTE: '참고', TIP: '팁', IMPORTANT: '중요', WARNING: '주의', CAUTION: '경고' };
    return `<div class="markdown-alert markdown-alert-${kind.toLowerCase()}"><p class="markdown-alert-title">${titles[kind]}</p>\n`;
};
/**
 * 알림 상자를 닫는다.
 * @returns {string} 알림 상자 종료 HTML
 */
markdown.renderer.rules.alert_close = () => '</div>\n';
/**
 * 제목마다 GitHub와 같은 규칙의 앵커 이름을 붙인다.
 * @param {object} state Markdown 변환 상태
 * @returns {void}
 */
markdown.core.ruler.push('github_headings', (state) => {
    const slugger = new GithubSlugger();
    for (let index = 0; index < state.tokens.length; index += 1) {
        if (state.tokens[index].type !== 'heading_open') continue;
        const text = (state.tokens[index + 1].children || [])
            .filter((token) => ['text', 'code_inline', 'emoji', 'math_inline', 'image'].includes(token.type))
            .map((token) => token.content).join('');
        state.tokens[index].attrSet('id', slugger.slug(text));
    }
});

/**
 * 해당 위치의 글자가 역슬래시로 벗어난 글자인지 확인한다.
 * 금액 표기를 수식 구분자로 오인하지 않기 위해 쓴다.
 * @param {string} text 검사할 원문
 * @param {number} position 검사할 글자 위치
 * @returns {boolean} 벗어난 글자면 참
 */
function isEscaped(text, position) {
    let count = 0;
    while (position > 0 && text[--position] === '\\') count += 1;
    return count % 2 === 1;
}

/**
 * 한 줄 안에 들어가는 수식을 찾아 토큰으로 만든다.
 * @param {object} state Markdown 인라인 변환 상태
 * @param {boolean} silent 확인만 하고 토큰을 만들지 않는 단계인지 여부
 * @returns {boolean} 수식을 찾았으면 참
 */
markdown.inline.ruler.before('escape', 'github_math', (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== '$') return false;
    const quoted = state.src[start + 1] === '`';
    if (!quoted && (state.src[start + 1] === '$' || /\s/.test(state.src[start + 1] || ' '))) return false;
    const offset = quoted ? 2 : 1;
    const delimiter = quoted ? '`$' : '$';
    let end = state.src.indexOf(delimiter, start + offset);
    while (end !== -1 && isEscaped(state.src, end)) end = state.src.indexOf(delimiter, end + delimiter.length);
    if (end === -1 || end >= state.posMax) return false;
    if (!quoted && (/\s/.test(state.src[end - 1]) || /\d/.test(state.src[end + 1] || ''))) return false;
    const content = state.src.slice(start + offset, end);
    if (!content || content.includes('\n')) return false;
    if (!silent) {
        const token = state.push('math_inline', 'span', 0);
        token.content = content;
    }
    state.pos = end + delimiter.length;
    return true;
});

/**
 * 여러 줄에 걸친 블록 수식을 찾아 토큰으로 만든다.
 * @param {object} state Markdown 블록 변환 상태
 * @param {number} startLine 검사를 시작하는 줄 번호
 * @param {number} endLine 검사할 수 있는 마지막 줄 번호
 * @param {boolean} silent 확인만 하고 토큰을 만들지 않는 단계인지 여부
 * @returns {boolean} 블록 수식을 찾았으면 참
 */
markdown.block.ruler.before('fence', 'github_math_block', (state, startLine, endLine, silent) => {
    const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
    if (!first.startsWith('$$')) return false;
    let content = first.slice(2);
    let nextLine = startLine + 1;
    if (content.trimEnd().endsWith('$$')) {
        content = content.trimEnd().slice(0, -2);
    } else {
        let closed = false;
        for (; nextLine < endLine; nextLine += 1) {
            const line = state.src.slice(state.bMarks[nextLine] + state.tShift[nextLine], state.eMarks[nextLine]);
            if (line.trim() === '$$') { closed = true; nextLine += 1; break; }
            content += `\n${line}`;
        }
        if (!closed) return false;
    }
    if (silent) return true;
    const token = state.push('math_block', 'div', 0);
    token.block = true;
    token.content = content.trim();
    token.map = [startLine, nextLine];
    state.line = nextLine;
    return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

/**
 * 수식이 들어갈 빈 자리를 만들고 나중에 채울 내용을 기록한다.
 * @param {string} content 수식 원문
 * @param {boolean} displayMode 블록 수식인지 여부
 * @param {{key: string, math: object[], diagrams: object[]}} environment 이번 변환에서 함께 쓰는 값 모음
 * @returns {string} 빈 자리 HTML
 */
function mathPlaceholder(content, displayMode, environment) {
    const key = `${environment.key}-math-${environment.math.length}`;
    environment.math.push({ key, content, displayMode });
    const tag = displayMode ? 'div' : 'span';
    return `<${tag} data-mdtool-math="${key}"></${tag}>`;
}
/**
 * 한 줄 수식의 빈 자리를 출력한다.
 * @param {object[]} tokens 변환 중인 토큰 목록
 * @param {number} index 지금 처리하는 토큰 위치
 * @param {object} options Markdown 변환 설정
 * @param {object} environment 이번 변환에서 함께 쓰는 값 모음
 * @returns {string} 빈 자리 HTML
 */
markdown.renderer.rules.math_inline = (tokens, index, options, environment) => mathPlaceholder(tokens[index].content, false, environment);

/**
 * 블록 수식의 빈 자리를 출력한다.
 * @param {object[]} tokens 변환 중인 토큰 목록
 * @param {number} index 지금 처리하는 토큰 위치
 * @param {object} options Markdown 변환 설정
 * @param {object} environment 이번 변환에서 함께 쓰는 값 모음
 * @returns {string} 빈 자리 HTML
 */
markdown.renderer.rules.math_block = (tokens, index, options, environment) => mathPlaceholder(tokens[index].content, true, environment);

/** Markdown 기본 코드 블록 출력 규칙이다. 특별히 다루지 않는 언어에 그대로 사용한다. */
const defaultFence = markdown.renderer.rules.fence;

/**
 * 코드 블록을 출력한다. math와 mermaid 블록은 나중에 채울 빈 자리로 바꾼다.
 * @param {object[]} tokens 변환 중인 토큰 목록
 * @param {number} index 지금 처리하는 토큰 위치
 * @param {object} options Markdown 변환 설정
 * @param {object} environment 이번 변환에서 함께 쓰는 값 모음
 * @param {object} renderer Markdown 출력기
 * @returns {string} 코드 블록 또는 빈 자리 HTML
 */
markdown.renderer.rules.fence = (tokens, index, options, environment, renderer) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/)[0].toLowerCase();
    if (language === 'math') return mathPlaceholder(token.content, true, environment);
    if (language === 'mermaid') {
        const key = `${environment.key}-diagram-${environment.diagrams.length}`;
        environment.diagrams.push({ key, content: token.content });
        return `<div data-mdtool-diagram="${key}"></div>`;
    }
    return defaultFence(tokens, index, options, environment, renderer);
};

/** 필요할 때 한 번만 내려받는 Mermaid 모듈이다. */
let mermaidModule;

/** 다이어그램 작업을 한 줄로 세우는 대기열이다. */
let diagramQueue = Promise.resolve();

/** 다이어그램마다 서로 다른 이름을 주기 위한 일련 번호다. */
let diagramNumber = 0;

/**
 * Mermaid 그림 하나를 SVG로 만든다.
 * Mermaid의 공유 설정이 미리보기와 저장 작업 사이에서 섞이지 않도록 순서대로 처리한다.
 * @param {string} content 다이어그램 원문
 * @param {'light'|'dark'} theme 적용할 테마
 * @returns {Promise<string>} 정리를 마친 SVG 문자열
 */
function renderDiagram(content, theme) {
    const job = diagramQueue.catch(() => {}).then(async () => {
        mermaidModule ||= import('mermaid');
        const { default: mermaid } = await mermaidModule;
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: theme === 'dark' ? 'dark' : 'default',
            suppressErrorRendering: true,
            flowchart: { htmlLabels: false },
            htmlLabels: false
        });
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-100000px;top:0;width:1000px;visibility:hidden;pointer-events:none';
        document.body.append(container);
        try {
            const result = await mermaid.render(`mdtool-diagram-${++diagramNumber}`, content, container);
            return DOMPurify.sanitize(result.svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                FORBID_TAGS: ['foreignObject'],
                ADD_TAGS: ['style']
            });
        } finally {
            container.remove();
        }
    });
    diagramQueue = job;
    return job;
}

/**
 * Markdown 원문을 문서 본문 HTML로 바꾼다.
 * 변환 결과를 정리한 뒤 신뢰할 수 있는 수식과 다이어그램 출력만 삽입한다.
 * @param {string} source Markdown 원문
 * @param {'light'|'dark'} theme 다이어그램에 적용할 테마
 * @returns {Promise<string>} 문서 본문 HTML
 */
async function renderMarkdown(source, theme) {
    const environment = { key: `render-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`, math: [], diagrams: [] };
    const fragment = DOMPurify.sanitize(markdown.render(source, environment), {
        RETURN_DOM_FRAGMENT: true,
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea', 'select'],
        FORBID_ATTR: ['style', 'contenteditable', 'autofocus', 'tabindex'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['data-mdtool-math', 'data-mdtool-diagram']
    });
    const container = document.createElement('div');
    container.append(fragment);
    // 체크박스는 보기 모드에서 문서를 수정하는 입력으로 동작하지 않게 한다.
    for (const input of container.querySelectorAll('input')) {
        if (input.type !== 'checkbox') input.remove();
        else input.disabled = true;
    }
    for (const link of container.querySelectorAll('a[href]')) {
        if (!link.getAttribute('href').startsWith('#')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    }
    for (const math of environment.math) {
        const element = container.querySelector(`[data-mdtool-math="${math.key}"]`);
        if (!element) continue;
        element.removeAttribute('data-mdtool-math');
        if (math.displayMode) element.className = 'math-block';
        element.innerHTML = katex.renderToString(math.content, {
            displayMode: math.displayMode, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000
        });
    }
    for (const diagram of environment.diagrams) {
        const element = container.querySelector(`[data-mdtool-diagram="${diagram.key}"]`);
        if (!element) continue;
        element.removeAttribute('data-mdtool-diagram');
        element.className = 'mermaid-diagram';
        try {
            element.innerHTML = await renderDiagram(diagram.content, theme);
        } catch {
            // 잘못된 다이어그램도 원문을 표시하여 나머지 문서 열람과 저장을 계속한다.
            element.innerHTML = `<p class="render-error">다이어그램을 표시하지 못했습니다. Mermaid 문법을 확인해 주세요.</p><pre><code>${escapeHtml(diagram.content)}</code></pre>`;
        }
    }
    return container.innerHTML;
}

/**
 * 미리보기와 저장본이 같은 서식과 테마를 갖도록 문서 HTML 한 벌을 만든다.
 * @param {string} source Markdown 원문
 * @param {string} filename 문서 제목에 넣을 파일명
 * @param {'light'|'dark'} theme 적용할 테마
 * @param {boolean} [standalone] 서식을 문서 안에 모두 담아 혼자 열리게 할지 여부
 * @param {boolean} [embedFonts] 독립 문서에 글꼴 자료까지 담을지 여부
 * @returns {Promise<string>} 완성한 문서 HTML
 */
async function createHtml(source, filename, theme, standalone = false, embedFonts = true) {
    const body = await renderMarkdown(source, theme);
    const mathStyles = body.includes('class="katex') ? MATH_STYLES : '';
    let styleMarkup;
    if (!standalone) {
        styleMarkup = `<link rel="stylesheet" href="${escapeHtml(documentStylesheet)}">${mathStyles ? `<style>${mathStyles}</style>` : ''}`;
    } else if (embedFonts) {
        // 큰 글꼴 데이터는 사용자가 HTML 내장을 선택한 경우에만 내려받는다.
        const { embedDocumentFonts } = await import('./embedded-document-fonts.js');
        styleMarkup = `<style>${embedDocumentFonts(documentStyles)}\n${mathStyles}</style>`;
    } else {
        // 내장 옵션을 끄면 일반 및 굵은 글꼴을 각각 CDN에서 가져온다.
        const cdnStyles = documentStyles
            .replace("url('../fonts/D2Coding.woff2') format('woff2');", `url('${D2CODING_CDN_FONTS.regular}') format('woff2'); font-display: swap;`)
            .replace("url('../fonts/D2CodingBold.woff2') format('woff2');", `url('${D2CODING_CDN_FONTS.bold}') format('woff2'); font-display: swap;`);
        styleMarkup = `<style>${cdnStyles}\n${mathStyles}</style>`;
    }
    const fontSource = standalone && !embedFonts
        ? 'data: https://cdn.jsdelivr.net'
        : "data: 'self'";
    const baseMarkup = standalone ? '' : `<base href="${escapeHtml(window.location.href)}">`;
    return `<!DOCTYPE html>
<html lang="ko" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${baseMarkup}
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src data: http: https: file:; font-src ${fontSource}; base-uri 'self'; form-action 'none'">
<title>${escapeHtml(filename)}</title>
${styleMarkup}
</head>
<body><main class="markdown-body">${body}</main></body>
</html>`;
}

/** 화면에서 다루는 요소를 DOM 아이디로 한 번만 찾아 둔다. */
const elements = Object.fromEntries([
    'editor', 'workspace', 'source-panel', 'preview-panel', 'preview', 'filename',
    'dirty-indicator', 'message', 'line-count', 'byte-count', 'theme-button', 'source-state',
    'file-input', 'save-dialog', 'save-message', 'new-button', 'open-button', 'save-button', 'print-button',
    'font-option', 'embed-fonts', 'pdf-theme-option', 'pdf-theme-light', 'pdf-theme-dark', 'download-button', 'cancel-save'
].map((id) => [id, document.getElementById(id)]));

/**
 * 지금 편집 중인 문서와 화면 상태다.
 * @type {{
 *     source: string, savedSource: string, filename: string,
 *     mode: 'edit'|'view'|'split', theme: 'light'|'dark', bom: boolean, newline: string
 * }}
 */
const state = { source: '', savedSource: '', filename: 'notitle', mode: 'edit', theme: 'light', bom: false, newline: '\n' };

/** 미리보기 요청 순번이다. 늦게 끝난 변환이 최신 화면을 덮어쓰지 못하게 한다. */
let previewRevision = 0;

/** 같이 보기에서 원문 입력이 멈추기를 기다리는 시간(밀리초)이다. */
const PREVIEW_DELAY = 300;

/** 예약해 둔 미리보기 갱신의 타이머 번호다. 0이면 예약이 없다. */
let previewTimer = 0;

/** 파일 열기 요청 순번이다. 먼저 고른 파일이 나중 선택을 덮어쓰지 못하게 한다. */
let fileRevision = 0;

/** 저장 작업이 진행 중인지 나타낸다. */
let saving = false;

/** 인쇄용 문서를 준비하고 있는지 나타낸다. */
let printing = false;

/** 인쇄용 문서의 그림과 글꼴을 기다리는 최대 시간이다. */
const PRINT_RESOURCE_TIMEOUT = 15000;

/** 저장 요청 순번이다. 저장 창을 닫으면 진행 중이던 요청을 버린다. */
let saveRevision = 0;

/**
 * 마지막으로 저장한 뒤 원문이 바뀌었는지 확인한다.
 * @returns {boolean} 수정된 내용이 있으면 참
 */
const isDirty = () => state.source !== state.savedSource;

/**
 * 원문을 Markdown 파일로 저장할 때의 바이트 자료를 만든다.
 * @param {string} [source] 저장할 원문
 * @param {boolean} [bom] 앞에 BOM을 붙일지 여부
 * @returns {Uint8Array} UTF-8로 바꾼 자료
 */
const markdownBytes = (source = state.source, bom = state.bom) => new TextEncoder().encode(`${bom ? '\uFEFF' : ''}${source}`);
/**
 * 편집기 기준의 줄 수를 센다. 마지막 줄바꿈 뒤의 빈 줄도 한 줄로 센다.
 * @param {string} source 셀 원문
 * @returns {number} 줄 수
 */
const countLines = (source) => source.split(/\r\n|\r|\n/).length;

// 원문 편집과 줄번호, Markdown 문법 강조는 Monaco 편집기가 모두 담당한다.
const sourceEditor = createSourceEditor({
    host: elements.editor,
    ariaLabel: 'Markdown 원문',
    placeholder: 'Markdown으로 새로운 문서를 작성해 보세요.',
    onChange: handleSourceChange
});

/**
 * 편집기에서 원문이 바뀌면 저장에 쓰는 줄바꿈 형식으로 되돌려 문서 상태에 반영한다.
 * @returns {void}
 */
function handleSourceChange() {
    if (state.mode === 'view') return;
    state.source = sourceEditor.getText().replace(/\n/g, state.newline);
    message('');
    updateStats();
    // 같이 보기에서는 원문을 고치는 대로 오른쪽 미리보기도 따라 갱신한다.
    if (state.mode === 'split') schedulePreview();
}

/**
 * 예약해 둔 미리보기 갱신을 취소한다.
 * @returns {void}
 */
function cancelScheduledPreview() {
    if (!previewTimer) return;
    window.clearTimeout(previewTimer);
    previewTimer = 0;
}

/**
 * 원문 입력이 잠시 멈춘 뒤에 미리보기를 다시 만들도록 예약한다.
 * 글자마다 변환하지 않아 입력이 끊기지 않는다.
 * @returns {void}
 */
function schedulePreview() {
    cancelScheduledPreview();
    previewTimer = window.setTimeout(() => {
        previewTimer = 0;
        void refreshPreview();
    }, PREVIEW_DELAY);
}

/**
 * 화면 위쪽 안내 줄에 알림을 표시한다.
 * @param {string} text 표시할 문구. 빈 문자열이면 안내를 지운다.
 * @param {boolean} [error] 오류 안내로 표시할지 여부
 * @returns {void}
 */
function message(text, error = false) {
    elements.message.textContent = text;
    elements.message.dataset.error = String(error);
}

/**
 * 파일명과 줄 수, 바이트 수, 수정 표시를 현재 문서 상태에 맞춘다.
 * @returns {void}
 */
function updateStats() {
    const lines = countLines(state.source);
    const bytes = markdownBytes().length;
    elements['line-count'].textContent = `${lines.toLocaleString('ko-KR')}줄`;
    elements['byte-count'].textContent = `${bytes.toLocaleString('ko-KR')} B`;
    elements['byte-count'].title = 'UTF-8로 Markdown을 저장할 때의 바이트 수';
    elements.filename.textContent = state.filename;
    elements['dirty-indicator'].hidden = !isDirty();
    document.title = `${isDirty() ? '● ' : ''}${state.filename} — Markdown Tool`;
}

/**
 * 지금 원문으로 미리보기를 다시 만든다.
 * @returns {Promise<void>}
 */
async function refreshPreview() {
    const revision = ++previewRevision;
    const { source, filename, theme } = state;
    elements.preview.setAttribute('aria-busy', 'true');
    try {
        const html = await createHtml(source, filename, theme);
        // 이전 파일이나 이전 테마의 늦은 렌더링이 최신 화면을 덮어쓰지 못하게 한다.
        if (revision === previewRevision) elements.preview.srcdoc = html;
    } catch {
        if (revision === previewRevision) {
            elements.preview.srcdoc = '';
            message('미리보기를 만들지 못했습니다. 원문은 그대로 보존되어 있습니다.', true);
        }
    } finally {
        if (revision === previewRevision) elements.preview.removeAttribute('aria-busy');
    }
}

/**
 * 화면 모드를 바꾸고 편집 가능 여부와 미리보기를 함께 맞춘다.
 * @param {'edit'|'view'|'split'} mode 적용할 화면 모드
 * @returns {void}
 */
function setMode(mode) {
    state.mode = mode;
    elements.workspace.dataset.mode = mode;
    elements['source-panel'].hidden = mode === 'view';
    elements['preview-panel'].hidden = mode === 'edit';
    // 보기 모드에서만 편집을 막는다. 같이 보기에서는 왼쪽에서 원문을 그대로 고칠 수 있다.
    sourceEditor.setReadOnly(mode === 'view');
    elements['source-state'].textContent = mode === 'view' ? '읽기 전용' : '편집 가능';
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    cancelScheduledPreview();
    if (mode !== 'edit') void refreshPreview();
    else previewRevision += 1;
    // 숨겼던 원문 영역이 다시 보이면 편집기 크기를 현재 화면에 맞춘다.
    if (mode !== 'view') requestAnimationFrame(() => sourceEditor.layout());
}

/**
 * 편집 중인 문서를 새 원문으로 바꾸고 편집 모드로 되돌린다.
 * @param {string} source 새 문서의 Markdown 원문
 * @param {string} filename 새 문서의 파일명
 * @param {boolean} [bom] 불러온 파일에 BOM이 있었는지 여부
 * @returns {void}
 */
function setDocument(source, filename, bom = false) {
    state.source = source;
    state.savedSource = source;
    state.filename = filename;
    state.bom = bom;
    state.newline = source.includes('\r\n') ? '\r\n' : source.includes('\r') && !source.includes('\n') ? '\r' : '\n';
    sourceEditor.setDocument(source);
    cancelScheduledPreview();
    previewRevision += 1;
    elements.preview.srcdoc = '';
    elements.preview.removeAttribute('aria-busy');
    updateStats();
    setMode('edit');
    sourceEditor.focus();
}

/**
 * 편집 중인 내용을 버려도 되는지 확인한다. 수정한 내용이 있으면 사용자에게 묻는다.
 * @returns {boolean} 문서를 바꿔도 되면 참
 */
function canReplaceDocument() {
    return !isDirty() || window.confirm('저장하지 않은 변경 사항이 있습니다. 내용을 버리고 계속할까요?');
}

/**
 * 고른 Markdown 파일을 읽어 편집기에 싣는다.
 * @param {File|undefined} file 사용자가 고른 파일
 * @returns {Promise<void>}
 */
async function openFile(file) {
    if (!file) return;
    const revision = ++fileRevision;
    if (!/\.(md|markdown)$/i.test(file.name)) {
        message('Markdown 파일(.md 또는 .markdown)을 선택해 주세요.', true);
        return;
    }
    try {
        const buffer = await file.arrayBuffer();
        // UTF-8이 아닌 파일은 조용히 깨뜨리지 않고 기존 문서를 유지한다.
        const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
        if (revision !== fileRevision || !canReplaceDocument()) return;
        const bom = source.startsWith('\uFEFF');
        setDocument(bom ? source.slice(1) : source, file.name, bom);
        message('파일을 불러왔습니다.');
    } catch {
        if (revision === fileRevision) message('파일을 읽지 못했습니다. UTF-8로 저장된 Markdown 파일인지 확인해 주세요.', true);
    }
}

/** 저장 형식마다 다운로드에 알려 줄 파일 종류다. */
const SAVE_TYPES = {
    md: 'text/markdown;charset=utf-8',
    html: 'text/html;charset=utf-8',
    pdf: 'application/pdf'
};

/**
 * 선택한 형식에 맞는 저장 자료를 만든다.
 * @param {'md'|'html'|'pdf'} format 저장 형식
 * @param {typeof state} snapshot 저장을 시작한 시점의 문서 상태
 * @param {boolean} embedFonts HTML 저장본에 글꼴을 담을지 여부
 * @param {'light'|'dark'} pdfTheme PDF 저장본에 적용할 테마
 * @returns {Promise<Uint8Array|string|ArrayBuffer>} 내려받을 자료
 */
async function createContents(format, snapshot, embedFonts, pdfTheme) {
    if (format === 'md') return markdownBytes(snapshot.source, snapshot.bom);
    if (format === 'html') return createHtml(snapshot.source, snapshot.filename, snapshot.theme, true, embedFonts);
    // PDF 변환에 쓰는 자료는 용량이 크므로 이 형식을 고를 때만 내려받는다.
    // 그림으로 떠 올 때는 바깥 자료를 다시 불러올 수 없어 글꼴까지 담은 독립 문서를 사용한다.
    const [html, { exportPdf }] = await Promise.all([
        createHtml(snapshot.source, snapshot.filename, pdfTheme, true, true),
        import('./pdf-export.js')
    ]);
    return exportPdf(html, snapshot.filename);
}

/**
 * 기존 파일명의 마지막 확장자를 바꿔 내려받을 이름을 만든다.
 * @param {string} filename 현재 문서의 파일명
 * @param {string} extension 새로 붙일 확장자
 * @returns {string} 내려받을 파일명
 */
function downloadName(filename, extension) {
    const lastDot = filename.lastIndexOf('.');
    const stem = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    return `${stem || 'notitle'}.${extension}`;
}

/**
 * 만든 자료를 브라우저 다운로드로 넘긴다.
 * @param {Uint8Array|string|ArrayBuffer} contents 내려받을 자료
 * @param {string} filename 내려받을 파일명
 * @param {string} type 파일 종류
 * @returns {void}
 */
function download(contents, filename, type) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // 다운로드가 시작되기 전에 URL이 해제되는 브라우저별 차이를 피한다.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * 인쇄용 문서의 글꼴이나 그림 준비를 제한 시간까지만 기다린다.
 * @param {Promise<unknown>} task 기다릴 작업
 * @returns {Promise<void>}
 */
function waitForPrintResource(task) {
    return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, PRINT_RESOURCE_TIMEOUT);
        Promise.resolve(task).then(() => {
            window.clearTimeout(timer);
            resolve();
        }, () => {
            window.clearTimeout(timer);
            resolve();
        });
    });
}

/**
 * 인쇄 창의 글꼴과 그림이 준비되고 화면 배치가 끝날 때까지 기다린다.
 * @param {Window} printWindow 인쇄할 문서를 담은 창
 * @returns {Promise<void>}
 */
async function waitForPrintLayout(printWindow) {
    const view = printWindow.document;
    if (view.fonts) await waitForPrintResource(view.fonts.ready);
    await Promise.all([...view.images].map((image) => {
        if (image.complete) return waitForPrintResource(image.decode ? image.decode() : Promise.resolve());
        return waitForPrintResource(new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
        }));
    }));
    await new Promise((resolve) => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve)));
}

/**
 * 현재 문서를 A4 페이지 여백이 적용된 독립 HTML로 만들어 브라우저 인쇄 창을 연다.
 * @returns {Promise<void>}
 */
async function printDocument() {
    if (printing) return;
    // 비동기 변환 뒤에 창을 열면 팝업 차단 대상이 되므로 클릭 처리 중 먼저 연다.
    const printWindow = window.open('', '_blank', 'popup,width=900,height=700');
    if (!printWindow) {
        message('인쇄 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.', true);
        return;
    }
    printing = true;
    elements['print-button'].disabled = true;
    const snapshot = { ...state };
    try {
        printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${escapeHtml(snapshot.filename)} 인쇄 준비</title></head><body><p>인쇄용 문서를 준비하고 있습니다…</p></body></html>`);
        printWindow.document.close();
        // 인쇄는 종이를 기준으로 밝기 테마를 사용하고, 상대 그림 주소는 현재 앱 주소를 기준으로 읽는다.
        const html = await createHtml(snapshot.source, snapshot.filename, 'light', true, true);
        if (printWindow.closed) return;
        const printHtml = html.replace('<meta http-equiv="Content-Security-Policy"', `<base href="${escapeHtml(window.location.href)}">\n<meta http-equiv="Content-Security-Policy"`);
        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();
        await waitForPrintLayout(printWindow);
        if (printWindow.closed) return;
        printWindow.focus();
        printWindow.print();
        message('브라우저 인쇄 창을 열었습니다.');
    } catch {
        if (!printWindow.closed) printWindow.close();
        message('인쇄용 문서를 만들지 못했습니다. 다시 시도해 주세요.', true);
    } finally {
        printing = false;
        elements['print-button'].disabled = false;
    }
}

/**
 * 저장 창에서 고른 형식으로 문서를 만들어 내려받는다.
 * @returns {Promise<void>}
 */
async function saveDocument() {
    if (saving) return;
    saving = true;
    const revision = ++saveRevision;
    const snapshot = { ...state };
    const format = document.querySelector('input[name="save-format"]:checked').value;
    const embedFonts = format === 'html' && elements['embed-fonts'].checked;
    const pdfTheme = format === 'pdf' && elements['pdf-theme-dark'].checked ? 'dark' : 'light';
    const options = [...elements['save-dialog'].querySelectorAll('input')];
    for (const option of options) option.disabled = true;
    elements['download-button'].disabled = true;
    elements['cancel-save'].disabled = true;
    elements['save-message'].textContent = '다운로드를 준비하고 있습니다…';
    try {
        const filename = downloadName(snapshot.filename, format);
        const contents = await createContents(format, snapshot, embedFonts, pdfTheme);
        if (revision !== saveRevision || !elements['save-dialog'].open) return;
        download(contents, filename, SAVE_TYPES[format]);
        // HTML 내보내기는 원문 저장을 대체하지 않으므로 Markdown 저장 때만 변경 표시를 해제한다.
        if (format === 'md' && state.source === snapshot.source) state.savedSource = snapshot.source;
        elements['save-dialog'].close();
        updateStats();
        message(`${filename} 다운로드를 요청했습니다.`);
    } catch {
        elements['save-message'].textContent = '저장 파일을 만들지 못했습니다. 다시 시도해 주세요.';
    } finally {
        saving = false;
        for (const option of options) option.disabled = false;
        elements['download-button'].disabled = false;
        elements['cancel-save'].disabled = false;
    }
}

/**
 * 화면과 편집기, 미리보기의 테마를 한꺼번에 바꾼다.
 * @param {'light'|'dark'} theme 적용할 테마
 * @param {boolean} [persist] 브라우저에 선택을 기억할지 여부
 * @returns {void}
 */
function applyTheme(theme, persist = true) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    elements['theme-button'].textContent = theme === 'dark' ? '밝기 모드' : '다크 모드';
    elements['theme-button'].setAttribute('aria-pressed', String(theme === 'dark'));
    sourceEditor.applyTheme(theme);
    if (persist) {
        try { localStorage.setItem('mdtool-theme', theme); } catch { /* 저장소가 차단되어도 화면 전환은 유지한다. */ }
    }
    if (state.mode !== 'edit') {
        cancelScheduledPreview();
        void refreshPreview();
    }
}

// 아래부터는 화면 조작을 문서 기능에 연결한다.

// 새로 만들기는 빈 문서로 되돌린다.
elements['new-button'].addEventListener('click', () => {
    if (!canReplaceDocument()) return;
    fileRevision += 1;
    setDocument('', 'notitle');
    message('새 문서를 만들었습니다.');
});
// 파일 불러오기 버튼은 숨겨 둔 파일 선택 창을 연다.
elements['open-button'].addEventListener('click', () => elements['file-input'].click());

// 같은 파일을 다시 고를 수 있도록 선택 값을 비운 뒤 읽는다.
elements['file-input'].addEventListener('change', () => {
    const file = elements['file-input'].files[0];
    elements['file-input'].value = '';
    void openFile(file);
});
// 화면 모드 라디오를 고르면 곧바로 모드를 바꾼다.
document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener('change', () => setMode(input.value));
});
/**
 * 저장 창을 기본 선택 상태로 되돌려 표시한다.
 * @returns {void}
 */
function showSaveDialog() {
    if (elements['save-dialog'].open) return;
    elements['save-message'].textContent = '';
    document.querySelector('input[name="save-format"][value="md"]').checked = true;
    elements['embed-fonts'].checked = true;
    elements['pdf-theme-light'].checked = state.theme === 'light';
    elements['pdf-theme-dark'].checked = state.theme === 'dark';
    elements['font-option'].hidden = true;
    elements['pdf-theme-option'].hidden = true;
    elements['save-dialog'].showModal();
}
elements['save-button'].addEventListener('click', showSaveDialog);
elements['print-button'].addEventListener('click', () => void printDocument());

// HTML 글꼴과 PDF 테마는 해당 저장 형식에서만 고를 수 있다.
document.querySelectorAll('input[name="save-format"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        const format = document.querySelector('input[name="save-format"]:checked').value;
        elements['font-option'].hidden = format !== 'html';
        elements['pdf-theme-option'].hidden = format !== 'pdf';
    });
});
elements['download-button'].addEventListener('click', () => void saveDocument());

// 창을 닫으면 준비 중이던 저장 자료는 버린다.
elements['save-dialog'].addEventListener('close', () => { saveRevision += 1; });

elements['theme-button'].addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

// Ctrl+S와 Cmd+S로도 저장 창을 연다.
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        showSaveDialog();
    }
});
// 수정한 내용이 남아 있으면 창을 닫기 전에 브라우저가 확인하도록 한다.
window.addEventListener('beforeunload', (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
});

/** 처음 적용할 테마다. 기억해 둔 선택이 없으면 브라우저의 밝기 설정을 따른다. */
let initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try {
    const savedTheme = localStorage.getItem('mdtool-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') initialTheme = savedTheme;
} catch { /* 브라우저의 기본 테마로 시작한다. */ }
applyTheme(initialTheme, false);
setDocument('', 'notitle');
