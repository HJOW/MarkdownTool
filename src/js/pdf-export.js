// PDF 저장에만 필요한 구현이다. 저장 형식으로 PDF를 고를 때만 이 모듈을 내려받는다.
// 문서 서식을 그대로 담기 위해 글꼴까지 넣은 문서 HTML을 숨긴 iframe에 그린 뒤,
// 그림으로 떠서 A4 쪽마다 배치한다.
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/** A4 용지 크기와 쪽 여백이다. 단위는 밀리미터다. */
const PAGE = { width: 210, height: 297, margin: 10 };

/** 문서를 그릴 때 사용하는 화면 너비다. 96dpi 기준 A4 너비와 같아 인쇄 비율이 자연스럽다. */
const RENDER_WIDTH = 794;

/** 글자가 흐려지지 않게 화면 크기의 몇 배로 그릴지 정한다. */
const RENDER_SCALE = 2;

/** 브라우저가 한 번에 다룰 수 있는 그림 크기다. 긴 문서는 이 한계 안에서 배율을 낮춘다. */
const CANVAS_LIMIT = { area: 2 ** 27, side: 32767 };

/** 쪽을 거의 비운 채 넘기지 않도록, 블록 경계에서 끊을 때 채워야 하는 최소 비율이다. */
const MIN_PAGE_FILL = 0.25;

/** 투명한 자리가 검게 나오지 않도록 쪽마다 미리 깔아 두는 종이색이다. */
const PAPER_COLOR = '#ffffff';

/** 문서에 들어 있는 그림을 가져오기까지 기다리는 시간이다. 단위는 밀리초다. */
const IMAGE_TIMEOUT = 15000;

/**
 * 문서 HTML을 숨긴 iframe에 띄우고 글꼴 준비까지 기다린다.
 * @param {string} html 글꼴과 서식을 모두 담은 문서 HTML
 * @returns {Promise<HTMLIFrameElement>} 내용과 글꼴 준비가 끝난 iframe
 */
async function openDocumentFrame(html) {
    const frame = document.createElement('iframe');
    // 원문에서 온 내용을 그리는 동안에도 스크립트를 실행하지 않는다.
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText = `position:fixed;left:-100000px;top:0;border:0;width:${RENDER_WIDTH}px;height:${PAGE.height}px`;
    await new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', () => reject(new Error('문서를 그리지 못했습니다.')), { once: true });
        // 내용을 먼저 정해야 빈 문서가 실렸다는 신호를 문서 준비 신호로 잘못 읽지 않는다.
        frame.srcdoc = html;
        document.body.append(frame);
    });
    // 글꼴을 기다리지 않으면 글자 너비가 어긋난 상태로 그려진다.
    await frame.contentDocument.fonts.ready.catch(() => { /* 글꼴 상태를 알 수 없어도 기본 글꼴로 계속 그린다. */ });
    return frame;
}

/**
 * 그림 자료를 문서에 직접 담을 수 있는 데이터 주소로 바꾼다.
 * @param {Blob} blob 내려받은 그림 자료
 * @returns {Promise<string>} `data:`로 시작하는 주소
 */
function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result), { once: true });
        reader.addEventListener('error', () => reject(reader.error), { once: true });
        reader.readAsDataURL(blob);
    });
}

/**
 * 문서 안의 그림을 문서에 직접 담긴 자료로 바꾼다.
 * 그림으로 떠 오는 단계에서는 바깥 주소를 다시 불러올 수 없어 미리 옮겨 둔다.
 * @param {Document} view 문서를 그린 iframe의 document
 * @returns {Promise<void>}
 */
async function inlineImages(view) {
    const images = [...view.images].filter((image) => !(image.currentSrc || image.src || 'data:').startsWith('data:'));
    await Promise.all(images.map(async (image) => {
        try {
            const address = image.currentSrc || image.src;
            const response = await fetch(address, { mode: 'cors', credentials: 'omit', signal: AbortSignal.timeout(IMAGE_TIMEOUT) });
            if (!response.ok) return;
            const dataUrl = await toDataUrl(await response.blob());
            // picture의 다른 후보가 주소를 다시 덮어쓰지 않도록 정리한다.
            for (const source of image.closest('picture')?.querySelectorAll('source') || []) source.remove();
            image.removeAttribute('srcset');
            image.src = dataUrl;
            await image.decode().catch(() => { /* 형식을 읽지 못한 그림은 빈 자리로 남는다. */ });
        } catch { /* 가져오지 못한 그림은 빈 자리로 남기고 나머지 문서를 계속 담는다. */ }
    }));
}

/**
 * 문서 내용의 실제 높이를 읽는다. 화면 높이에 맞춰 늘어난 값은 쓰지 않는다.
 * @param {Document} view 문서를 그린 iframe의 document
 * @returns {number} 화면 픽셀 단위의 내용 높이
 */
function contentHeight(view) {
    const content = view.querySelector('.markdown-body') || view.body;
    return Math.max(Math.ceil(content.getBoundingClientRect().height), 1);
}

/**
 * 쪽을 끊어도 좋은 세로 위치를 문서 위에서부터 모은다.
 * 최상위 블록의 아래쪽 경계만 사용하므로 문단이나 표가 중간에서 잘리지 않는다.
 * @param {Document} view 문서를 그린 iframe의 document
 * @returns {number[]} 화면 픽셀 단위의 끊을 수 있는 위치 목록
 */
function collectPageBreaks(view) {
    const breaks = [];
    for (const block of view.querySelectorAll('.markdown-body > *')) {
        // 제목만 남기고 쪽을 넘기지 않도록 제목 뒤에서는 끊지 않는다.
        if (/^H[1-6]$/.test(block.tagName)) continue;
        const bottom = block.getBoundingClientRect().bottom;
        if (bottom > 0) breaks.push(bottom);
    }
    return breaks.sort((left, right) => left - right);
}

/**
 * 그림 크기 한계를 넘지 않는 배율을 고른다.
 * @param {number} height 문서 전체 높이의 화면 픽셀 값
 * @returns {number} 실제로 사용할 배율
 */
function fittingScale(height) {
    const byArea = Math.sqrt(CANVAS_LIMIT.area / (RENDER_WIDTH * height));
    const bySide = CANVAS_LIMIT.side / height;
    return Math.max(Math.min(RENDER_SCALE, byArea, bySide), 0.2);
}

/**
 * 문서 전체를 그림 한 장으로 떠 온다.
 * 브라우저가 직접 그리는 방식을 먼저 쓰고, 실패하면 요소를 하나씩 그리는 방식으로 되돌린다.
 * @param {Document} view 문서를 그린 iframe의 document
 * @param {number} height 떠 올 내용 높이
 * @param {number} scale 사용할 배율
 * @returns {Promise<HTMLCanvasElement>} 문서 전체를 담은 그림
 */
async function captureDocument(view, height, scale) {
    const options = {
        backgroundColor: PAPER_COLOR,
        scale,
        width: RENDER_WIDTH,
        height,
        windowWidth: RENDER_WIDTH,
        windowHeight: height,
        imageTimeout: IMAGE_TIMEOUT,
        logging: false
    };
    try {
        // 브라우저가 직접 그리면 수식의 가는 선과 요소 위치까지 화면과 같게 나온다.
        return await html2canvas(view.body, { ...options, foreignObjectRendering: true });
    } catch {
        return html2canvas(view.body, { ...options, useCORS: true });
    }
}

/**
 * 문서 전체 그림에서 한 쪽에 담을 부분만 잘라 낸다.
 * @param {HTMLCanvasElement} source 문서 전체를 담은 그림
 * @param {number} top 잘라 낼 위치의 위쪽 픽셀
 * @param {number} height 잘라 낼 높이의 픽셀
 * @returns {HTMLCanvasElement} 한 쪽 분량만 담은 그림
 */
function slicePage(source, top, height) {
    const page = document.createElement('canvas');
    page.width = source.width;
    page.height = height;
    const context = page.getContext('2d');
    context.fillStyle = PAPER_COLOR;
    context.fillRect(0, 0, page.width, page.height);
    context.drawImage(source, 0, top, source.width, height, 0, 0, source.width, height);
    return page;
}

/**
 * 끊을 위치 목록을 보고 이번 쪽의 아래쪽 경계를 정한다.
 * @param {number[]} breaks 끊을 수 있는 위치 목록
 * @param {number} top 이번 쪽이 시작하는 위치
 * @param {number} limit 이번 쪽에 담을 수 있는 마지막 위치
 * @param {number} pageHeight 한 쪽에 담기는 높이
 * @returns {number} 이번 쪽을 끝낼 위치
 */
function pageBottom(breaks, top, limit, pageHeight) {
    const candidates = breaks.filter((position) => position > top && position <= limit);
    const candidate = candidates[candidates.length - 1];
    // 쪽이 거의 비는 자리에서 끊기보다 긴 블록을 잘라 채우는 편이 읽기 좋다.
    if (candidate && candidate - top >= pageHeight * MIN_PAGE_FILL) return candidate;
    return limit;
}

/**
 * 글꼴과 서식을 담은 문서 HTML을 A4 PDF로 만든다.
 * @param {string} html 문서 HTML. 글꼴과 스타일이 문서 안에 들어 있어야 한다.
 * @param {string} filename PDF 속성에 넣을 문서 이름
 * @returns {Promise<ArrayBuffer>} 내려받을 PDF 자료
 */
export async function exportPdf(html, filename) {
    const frame = await openDocumentFrame(html);
    let canvas;
    try {
        const view = frame.contentDocument;
        await inlineImages(view);
        const height = contentHeight(view);
        frame.style.height = `${height}px`;
        const breaks = collectPageBreaks(view);
        const scale = fittingScale(height);
        canvas = await captureDocument(view, height, scale);
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        pdf.setProperties({ title: filename, creator: 'Markdown Tool' });
        const contentWidth = PAGE.width - PAGE.margin * 2;
        const millimeterPerPixel = contentWidth / RENDER_WIDTH;
        const pageHeight = (PAGE.height - PAGE.margin * 2) / millimeterPerPixel;
        let top = 0;
        while (top < height - 1) {
            const bottom = pageBottom(breaks, top, Math.min(top + pageHeight, height), pageHeight);
            if (top > 0) pdf.addPage();
            const page = slicePage(canvas, Math.round(top * scale), Math.round((bottom - top) * scale));
            pdf.addImage(page, 'PNG', PAGE.margin, PAGE.margin, contentWidth, (bottom - top) * millimeterPerPixel, undefined, 'FAST');
            top = bottom;
        }
        return pdf.output('arraybuffer');
    } finally {
        // 그림과 iframe은 용량이 크므로 실패한 경우에도 바로 치운다.
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
        frame.remove();
    }
}
