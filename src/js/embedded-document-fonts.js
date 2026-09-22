import regularFont from '../fonts/D2Coding.woff2';
import boldFont from '../fonts/D2CodingBold.woff2';

/**
 * 문서 서식의 글꼴 주소를 글꼴 자료 자체로 바꾼다.
 * 사용자가 글꼴 포함을 선택했을 때만 호출하므로 기본 화면은 이 자료를 내려받지 않는다.
 * @param {string} styles 문서 서식 CSS 원문
 * @returns {string} D2Coding 일반체와 굵은체를 직접 담은 CSS
 */
export function embedDocumentFonts(styles) {
    return styles
        .replace("url('../fonts/D2Coding.woff2')", `url('${regularFont}')`)
        .replace("url('../fonts/D2CodingBold.woff2')", `url('${boldFont}')`);
}
