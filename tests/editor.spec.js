const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

/** 편집기의 입력 창구다. Monaco는 EditContext를 지원하면 해당 요소를, 아니면 숨은 textarea를 쓴다. */
const EDITOR_INPUT = '#editor :is(.native-edit-context, textarea.inputarea)';

/** 편집기가 그린 줄번호 요소다. */
const LINE_NUMBERS = '#editor .margin-view-overlays .line-numbers';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(EDITOR_INPUT)).toBeFocused();
});

/**
 * Monaco 편집기의 원문을 지정한 내용으로 바꾼다.
 * @param {import('@playwright/test').Page} page 검사 중인 화면
 * @param {string} source 넣을 Markdown 원문
 * @returns {Promise<void>}
 */
async function setSource(page, source) {
    await page.locator(EDITOR_INPUT).focus();
    await page.keyboard.press('Control+A');
    if (!source) {
        await page.keyboard.press('Delete');
        return;
    }
    // 붙여넣기로 넣으면 자동 들여쓰기가 끼어들지 않아 준비한 원문이 그대로 들어간다.
    await page.evaluate((text) => navigator.clipboard.writeText(text), source);
    await page.keyboard.press('Control+V');
}

/**
 * 편집기가 표시하는 줄번호를 작은 수부터 읽는다. 화면에 그려진 줄만 확인할 수 있다.
 * @param {import('@playwright/test').Page} page 검사 중인 화면
 * @returns {Promise<number[]>} 화면에 보이는 줄번호
 */
async function lineNumbers(page) {
    const numbers = await page.locator(LINE_NUMBERS).allTextContents();
    return numbers.map((number) => Number(number.trim())).sort((left, right) => left - right);
}

/**
 * 화면 모드를 바꾸고 미리보기 변환이 끝나기를 기다린다.
 * @param {import('@playwright/test').Page} page 검사 중인 화면
 * @param {'edit'|'view'|'split'} mode 고를 화면 모드
 * @returns {Promise<void>}
 */
async function changeMode(page, mode) {
    await page.locator(`input[name="mode"][value="${mode}"]`).check();
    if (mode !== 'edit') await expect(page.locator('#preview')).not.toHaveAttribute('aria-busy', 'true');
}

/**
 * 저장 대화상자에서 형식과 글꼴 옵션을 고른 뒤 다운로드를 시작한다.
 * @param {import('@playwright/test').Page} page 검사 중인 화면
 * @param {'md'|'html'|'pdf'} format 고를 저장 형식
 * @param {boolean} [embedFonts] HTML 저장에서 글꼴 포함을 켤지 여부
 * @param {'light'|'dark'} [pdfTheme] PDF 저장에 적용할 테마
 * @returns {Promise<import('@playwright/test').Download>} 시작된 다운로드
 */
async function save(page, format, embedFonts = true, pdfTheme = 'light') {
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.locator(`input[name="save-format"][value="${format}"]`).check();
    if (format === 'html') {
        await expect(page.locator('#font-option')).toBeVisible();
        await page.locator('#embed-fonts').setChecked(embedFonts);
        await expect(page.locator('#pdf-theme-option')).toBeHidden();
    } else if (format === 'pdf') {
        await expect(page.locator('#font-option')).toBeHidden();
        await expect(page.locator('#pdf-theme-option')).toBeVisible();
        await page.locator(`input[name="pdf-theme"][value="${pdfTheme}"]`).check();
    } else {
        await expect(page.locator('#font-option')).toBeHidden();
        await expect(page.locator('#pdf-theme-option')).toBeHidden();
    }
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click();
    return pending;
}

test('빈 문서, 줄번호, 공백 줄과 UTF-8 바이트를 표시한다', async ({ page }) => {
    await expect(page.locator('#filename')).toHaveText('notitle');
    await expect(page.locator('#line-count')).toHaveText('1줄');
    await expect(page.locator('#byte-count')).toHaveText('0 B');
    await expect(page.locator('#editor .editorPlaceholder')).toBeVisible();
    expect(await lineNumbers(page)).toEqual([1]);
    const source = '한글\n \n\n끝😀\n';
    await setSource(page, source);
    await expect(page.locator('#line-count')).toHaveText('5줄');
    await expect(page.locator('#byte-count')).toHaveText(`${Buffer.byteLength(source)} B`);
    expect(await lineNumbers(page)).toEqual([1, 2, 3, 4, 5]);
    await expect(page.locator('#dirty-indicator')).toBeVisible();
});

test('편집기가 Markdown 문법을 강조하고 줄번호를 한 번만 표시한다', async ({ page }) => {
    await setSource(page, '일반 문장과 `코드`와 **굵게**');
    // 문법 강조 규칙은 필요한 시점에 따로 내려받으므로 색 구분이 적용될 때까지 기다린다.
    await expect.poll(async () => {
        const classes = await page.locator('#editor .view-lines .view-line span > span')
            .evaluateAll((spans) => spans.map((span) => span.className));
        return new Set(classes).size;
    }).toBeGreaterThan(1);
    // 줄번호는 편집기가 직접 표시하므로 화면에 별도 줄번호 영역이 남아 있으면 안 된다.
    await expect(page.locator('#editor .margin-view-overlays')).toHaveCount(1);
    await expect(page.locator('#line-numbers, .line-gutter, .editor-area pre')).toHaveCount(0);
    expect(await lineNumbers(page)).toEqual([1]);
    const fontFamily = await page.locator('#editor .view-lines').evaluate((lines) => getComputedStyle(lines).fontFamily);
    expect(fontFamily).toContain('D2Coding');
});

test('모드 전환 시 원문을 유지하고 보기에서만 편집을 막는다', async ({ page }) => {
    await setSource(page, '# 문서 제목\n\n**굵은 글씨**');
    const bytes = await page.locator('#byte-count').textContent();
    await changeMode(page, 'view');
    await expect(page.locator('#source-panel')).toBeHidden();
    await expect(page.locator('#editor')).toHaveAttribute('data-readonly', 'true');
    await expect(page.frameLocator('#preview').getByRole('heading', { name: '문서 제목' })).toBeVisible();
    await changeMode(page, 'split');
    await expect(page.locator('#source-panel')).toBeVisible();
    await expect(page.locator('#source-state')).toHaveText('편집 가능');
    await expect(page.locator('#editor')).toHaveAttribute('data-readonly', 'false');
    // 같이 보기에서 고친 원문은 문서 상태와 오른쪽 미리보기에 함께 반영된다.
    await setSource(page, '# 같이 보기 제목');
    await expect(page.locator('#editor .view-lines')).toContainText('같이 보기 제목');
    await expect(page.locator('#byte-count')).not.toHaveText(bytes);
    await expect(page.frameLocator('#preview').getByRole('heading', { name: '같이 보기 제목' })).toBeVisible();
    const layout = await page.locator('#workspace').evaluate((workspace) => {
        const left = workspace.children[0].getBoundingClientRect();
        const right = workspace.children[1].getBoundingClientRect();
        return { sideBySide: left.right <= right.left + 1, sameTop: left.top === right.top };
    });
    expect(layout).toEqual({ sideBySide: true, sameTop: true });
    await changeMode(page, 'edit');
    await expect(page.locator('#source-state')).toHaveText('편집 가능');
    await expect(page.locator('#preview-panel')).toBeHidden();
    await setSource(page, '# 수정한 제목');
    await changeMode(page, 'view');
    await expect(page.frameLocator('#preview').getByRole('heading', { name: '수정한 제목' })).toBeVisible();
});

test('GitHub 표, 접힌 영역, 각주, 알림, 코드, 이모지와 앵커를 변환한다', async ({ page }) => {
    const source = [
        '# 문서 제목', '', '[제목으로](#문서-제목)', '',
        '| 항목 | 수량 |', '| :--- | ---: |', '| 책 | 2 |', '',
        '- [x] 완료', '- [ ] 예정', '',
        '<details><summary>더 보기</summary>', '', '**접힌 내용**', '', '</details>', '',
        '각주[^설명]와 ~~취소선~~ :smile:', '', '[^설명]: 각주 본문', '',
        '> [!NOTE]', '> 중요한 참고', '', '> [!WARNING]', '> 확인이 필요합니다.', '',
        '```javascript', 'const number = 42;', '```', '',
        '<picture><source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.png"><img alt="그림" src="data:image/png;base64,iVBORw0KGgo="></picture>', '',
        '<!-- 숨긴 메모 -->', '', '# 문서 제목'
    ].join('\n');
    await setSource(page, source);
    await changeMode(page, 'view');
    const frame = page.frameLocator('#preview');
    await expect(frame.locator('table tbody td').nth(1)).toHaveText('2');
    await expect(frame.locator('table th').nth(1)).toHaveAttribute('align', 'right');
    await expect(frame.locator('input[type="checkbox"]')).toHaveCount(2);
    await expect(frame.locator('input[type="checkbox"]').first()).toBeChecked();
    await expect(frame.locator('input[type="checkbox"]').first()).toBeDisabled();
    await frame.locator('summary').click();
    await expect(frame.locator('details strong')).toBeVisible();
    await expect(frame.locator('.footnotes')).toContainText('각주 본문');
    await expect(frame.locator('.markdown-alert-note')).toContainText('중요한 참고');
    await expect(frame.locator('.markdown-alert-warning')).toContainText('확인이 필요합니다.');
    await expect(frame.locator('.hljs-keyword')).toHaveText('const');
    await expect(frame.locator('s')).toHaveText('취소선');
    await expect(frame.locator('body')).toContainText('😄');
    await expect(frame.locator('picture source')).toHaveCount(1);
    await expect(frame.locator('h1').nth(0)).toHaveAttribute('id', '문서-제목');
    await expect(frame.locator('h1').nth(1)).toHaveAttribute('id', '문서-제목-1');
    await expect(frame.locator('body')).not.toContainText('숨긴 메모');
    await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('수식과 Mermaid를 렌더링하고 잘못된 다이어그램 뒤의 본문도 유지한다', async ({ page }) => {
    const source = [
        '수식 $x^2$ 와 $`\\sqrt{4}`$ 입니다.', '', '$$x+y=3$$', '',
        '```math', '\\frac{1}{2}', '```', '',
        '```mermaid', 'graph LR', 'A[시작] --> B[완료]', '```', '',
        '```mermaid', 'this is invalid !!!', '```', '', '**마지막 문단**'
    ].join('\n');
    await setSource(page, source);
    await changeMode(page, 'view');
    const frame = page.frameLocator('#preview');
    await expect(frame.locator('.katex')).toHaveCount(4);
    await expect(frame.locator('.mermaid-diagram svg')).toHaveCount(1);
    await expect(frame.locator('.mermaid-diagram svg')).toContainText('시작');
    await expect(frame.locator('.render-error')).toBeVisible();
    await expect(frame.getByText('마지막 문단', { exact: true })).toBeVisible();
    await expect(page.locator('body > div[id^="dmdtool-diagram"]')).toHaveCount(0);
});

test('위험한 HTML을 미리보기와 내보내기 모두에서 제거한다', async ({ page }) => {
    const source = [
        '# 안전한 제목', '',
        '<script>window.pwned=true</script>',
        '<img src="bad" onerror="window.pwned=true">',
        '<a href="javascript:alert(1)">위험 링크</a>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '<style>body{display:none}</style>',
        '<div contenteditable="true" style="position:fixed">본문</div>',
        '<input value="입력">', '<input type="checkbox">'
    ].join('\n');
    await setSource(page, source);
    await changeMode(page, 'view');
    const frame = page.frameLocator('#preview');
    await expect(frame.locator('.markdown-body script, .markdown-body iframe, .markdown-body style, [onerror], [contenteditable], [href^="javascript:"]')).toHaveCount(0);
    await expect(frame.locator('input')).toHaveCount(1);
    await expect(frame.locator('input')).toBeDisabled();
    await expect(frame.getByRole('heading', { name: '안전한 제목' })).toBeVisible();
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    const downloaded = await save(page, 'html');
    const html = await fs.readFile(await downloaded.path(), 'utf8');
    expect(html).not.toMatch(/onerror=|contenteditable=|<script|javascript:alert/);
    expect(html).toContain("script-src 'none'");
});

test('파일명을 기억하고 UTF-8 BOM 및 CRLF 원문을 Markdown으로 보존한다', async ({ page }) => {
    const original = Buffer.from('﻿# 한글\r\n\r\n본문\r\n', 'utf8');
    await page.locator('#file-input').setInputFiles({ name: '회의.초안.MD', mimeType: 'text/markdown', buffer: original });
    await expect(page.locator('#filename')).toHaveText('회의.초안.MD');
    await expect(page.locator('#editor .view-lines')).toContainText('# 한글');
    await expect(page.locator('#editor .editorPlaceholder')).toBeHidden();
    await expect(page.locator('#byte-count')).toHaveText(`${original.length} B`);
    expect(await lineNumbers(page)).toEqual([1, 2, 3, 4]);
    const downloaded = await save(page, 'md');
    expect(downloaded.suggestedFilename()).toBe('회의.초안.md');
    expect(await fs.readFile(await downloaded.path())).toEqual(original);
    await setSource(page, '수정\n본문');
    const edited = await save(page, 'md');
    expect(await fs.readFile(await edited.path(), 'utf8')).toBe('﻿수정\r\n본문');
    await expect(page.locator('#dirty-indicator')).toBeHidden();
});

test('잘못된 인코딩과 확장자는 기존 문서를 보존하고 동일 파일 재선택도 처리한다', async ({ page }) => {
    await setSource(page, '보존할 원문');
    await page.locator('#file-input').setInputFiles({ name: '문서.md', mimeType: 'text/markdown', buffer: Buffer.from([0xff, 0xfe, 0x41]) });
    await expect(page.locator('#message')).toContainText('UTF-8');
    await expect(page.locator('#editor .view-lines')).toHaveText('보존할 원문');
    await page.locator('#file-input').setInputFiles({ name: '문서.txt', mimeType: 'text/plain', buffer: Buffer.from('교체') });
    await expect(page.locator('#message')).toContainText('.md');
    await expect(page.locator('#editor .view-lines')).toHaveText('보존할 원문');
    const file = { name: '문서.md', mimeType: 'text/markdown', buffer: Buffer.from('정상 원문') };
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('#file-input').setInputFiles(file);
    await expect(page.locator('#editor .view-lines')).toHaveText('보존할 원문');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#file-input').setInputFiles(file);
    await expect(page.locator('#editor .view-lines')).toHaveText('정상 원문');
});

test('저장 취소, 새로 만들기 취소 및 확정, 기본 다운로드 이름을 처리한다', async ({ page }) => {
    await setSource(page, '# 기존 내용');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('#save-dialog')).toBeVisible();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.locator('#save-dialog')).toBeHidden();
    await expect(page.locator('#editor .view-lines')).toHaveText('# 기존 내용');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: '새로 만들기' }).click();
    await expect(page.locator('#editor .view-lines')).toHaveText('# 기존 내용');
    await changeMode(page, 'view');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '새로 만들기' }).click();
    await expect(page.locator('#filename')).toHaveText('notitle');
    await expect(page.locator('#byte-count')).toHaveText('0 B');
    await expect(page.locator('#line-count')).toHaveText('1줄');
    expect(await lineNumbers(page)).toEqual([1]);
    await changeMode(page, 'view');
    await expect(page.frameLocator('#preview').locator('.markdown-body')).toBeEmpty();
    const downloaded = await save(page, 'md');
    expect(downloaded.suggestedFilename()).toBe('notitle.md');
    expect(await fs.readFile(await downloaded.path(), 'utf8')).toBe('');
});

test('HTML 저장본에 수식, 다이어그램, 서식을 포함하고 오프라인으로 표시한다', async ({ page, context }, testInfo) => {
    const source = '# 내보낸 문서\n\n$x^2$\n\n```mermaid\ngraph LR\nA[시작] --> B[끝]\n```';
    await page.locator('#file-input').setInputFiles({ name: '결과.초안.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
    await expect(page.locator('#filename')).toHaveText('결과.초안.md');
    const downloaded = await save(page, 'html');
    expect(downloaded.suggestedFilename()).toBe('결과.초안.html');
    const outputPath = testInfo.outputPath('exported.html');
    await downloaded.saveAs(outputPath);
    const html = await fs.readFile(outputPath, 'utf8');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).not.toContain('<script');
    const exported = await context.newPage();
    await context.setOffline(true);
    await exported.goto(pathToFileURL(outputPath).href);
    await expect(exported.getByRole('heading', { name: '내보낸 문서' })).toBeVisible();
    await expect(exported.locator('.katex')).toBeVisible();
    await expect(exported.locator('.mermaid-diagram svg')).toBeVisible();
    expect(await exported.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px KaTeX_Main')))).toBe(true);
    await context.setOffline(false);
});

test('PDF 저장본을 A4 여러 쪽으로 나누고 원문 수정 표시는 유지한다', async ({ page }) => {
    const sections = Array.from({ length: 30 }, (_, index) => `## ${index + 1}번째 절\n\n${index + 1}번째 절의 본문입니다.`);
    await setSource(page, [`# PDF 문서`, '', '수식 $x^2$ 와 **굵게** 를 담습니다.', '', ...sections].join('\n'));
    const downloaded = await save(page, 'pdf');
    expect(downloaded.suggestedFilename()).toBe('notitle.pdf');
    const pdf = await fs.readFile(await downloaded.path());
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const structure = pdf.toString('latin1');
    // A4 세로 크기를 포인트 단위로 적어 두므로 용지 설정을 확인할 수 있다.
    expect(structure).toContain('/MediaBox [0 0 595.2799');
    const pages = Number(/\/Count (\d+)/.exec(structure)[1]);
    expect(pages).toBeGreaterThan(1);
    // PDF는 원문 저장을 대체하지 않으므로 수정 표시를 남긴다.
    await expect(page.locator('#dirty-indicator')).toBeVisible();
});

test('PDF 테마는 저장본에서만 고르고 현재 화면 테마를 바꾸지 않는다', async ({ page }) => {
    const appTheme = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.locator('input[name="save-format"][value="pdf"]').check();
    await expect(page.locator('#pdf-theme-option')).toBeVisible();
    await page.locator('#pdf-theme-dark').check();
    await expect(page.locator('#pdf-theme-dark')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', appTheme);
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.locator('#save-dialog')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', appTheme);
});

test('인쇄용 문서에 A4 페이지 여백을 적용하고 브라우저 인쇄를 호출한다', async ({ page, context }) => {
    await context.addInitScript(() => {
        window.print = () => { document.documentElement.dataset.printCalled = 'true'; };
    });
    await setSource(page, '# 인쇄 문서\n\n본문입니다.\n\n```javascript\nconst printed = true;\n```');
    const appTheme = await page.locator('html').getAttribute('data-theme');
    const pendingPopup = context.waitForEvent('page');
    await page.getByRole('button', { name: '인쇄', exact: true }).click();
    const printed = await pendingPopup;
    await expect(printed.getByRole('heading', { name: '인쇄 문서' })).toBeVisible();
    await expect(printed.locator('html')).toHaveAttribute('data-theme', 'light');
    const printStyles = (await printed.locator('style').allTextContents()).join('\n');
    expect(printStyles).toContain('@page { size: A4 portrait; margin: 10mm; }');
    expect(printStyles).toContain('break-inside: avoid-page');
    await expect(printed.locator('html')).toHaveAttribute('data-print-called', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', appTheme);
    await expect(page.locator('#dirty-indicator')).toBeVisible();
    await printed.close();
});

test('테마를 유지하고 줄번호 스크롤과 좁은 화면을 처리한다', async ({ page }) => {
    await page.locator('#theme-button').click();
    const theme = await page.locator('html').getAttribute('data-theme');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await setSource(page, Array.from({ length: 100 }, (_, index) => `줄 ${index + 1}`).join('\n'));
    await page.locator('#editor').hover();
    await page.mouse.wheel(0, 500);
    // 편집기를 굴리면 줄번호도 함께 움직여 첫 줄이 화면에서 벗어난다.
    await expect.poll(async () => (await lineNumbers(page))[0]).toBeGreaterThan(1);
    await changeMode(page, 'split');
    await expect(page.frameLocator('#preview').locator('html')).toHaveAttribute('data-theme', theme);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('button', { name: '새로 만들기' })).toBeVisible();
    expect(await page.locator('#open-button').evaluate((button) => button.scrollWidth <= button.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('웹 서버는 페이지와 자원을 제공하고 프로젝트 파일은 노출하지 않는다', async ({ request }) => {
    const root = await request.get('/');
    expect(root.status()).toBe(200);
    expect(root.headers()['content-type']).toContain('text/html');
    expect((await request.get('/css/mdtool.css')).status()).toBe(200);
    expect((await request.get('/dist/mdtool.js')).status()).toBe(200);
    expect((await request.get('/dist/mdtool.css')).status()).toBe(200);
    expect((await request.get('/package.json')).status()).toBe(404);
    expect((await request.get('/TODO.md')).status()).toBe(404);
});
