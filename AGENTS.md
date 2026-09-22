# Markdown Tool 프로젝트 지침

## 프로젝트 소개

Markdown Tool은 브라우저에서 Markdown 파일을 작성하고, 보기 및 나란히 보기로 확인하며, 원문이나 변환한 HTML을 내려받는 웹 도구다. Node.js 서버는 화면과 정적 파일을 제공한다. 파일을 열고 편집하고 변환하는 일은 브라우저에서 처리한다.

지원 범위와 사용자 동작은 [README.md](README.md)를 확인하고, 새 요구사항은 현재 [TODO.md](TODO.md)를 먼저 읽는다. TODO가 비어 있거나 기존 설명과 구현이 다르면 README와 현재 소스를 함께 살펴보고 사용자가 요청한 범위만 변경한다. 이전 TODO 또는 변경 전 동작을 근거로 새 요구사항을 추측하지 않는다.

## 주요 파일과 역할

| 경로 | 역할과 주의점 |
| --- | --- |
| `index.js` | CommonJS Express 서버. `src`를 웹 루트로 제공하고 기본 포트 9803과 `PORT` 환경 변수를 지원한다. 앱 코드에서 서버 요청이나 문서 내용을 받지 않는다. |
| `src/index.html` | 툴바, 편집기, 미리보기 iframe, 저장 대화상자의 화면 구조와 DOM ID를 정의한다. `#editor`는 Monaco 편집기를 붙이는 빈 요소이며, 빌드가 만드는 `dist/mdtool.css`를 함께 불러온다. 동작을 바꾸면 `src/js/mdtool.js`의 이벤트 연결도 맞춘다. |
| `src/js/mdtool.js` | 브라우저 프로그램의 주요 구현. 문서와 화면 상태, 파일 열기·저장, Markdown 변환, 테마, 미리보기, HTML 생성이 들어 있다. |
| `src/js/markdown-editor.js` | 원문 편집에 쓰는 Monaco 편집기 설정. 편집에 필요한 기여 모듈만 골라 가져오고, 문법 강조·줄번호·편집기 테마·작업자 경로를 정한다. |
| `src/js/pdf-export.js` | PDF 저장 구현이다. 글꼴을 담은 문서 HTML을 숨긴 iframe에 그려 A4 쪽으로 나눈다. 실행은 PDF 저장에서만 하지만 단일 번들 정책에 따라 코드는 메인 JavaScript에 포함된다. |
| `src/js/embedded-document-fonts.js` | HTML 저장에서 **글꼴 포함**을 선택했을 때 쓰는 글꼴 자료와 CSS 변환 코드다. 단일 번들 정책에 따라 코드는 메인 JavaScript에 포함된다. |
| `src/css/fonts.css` | 편집기 UI 전역의 글꼴 설정. 현재 `src/fonts/`의 D2Coding 글꼴을 사용한다. |
| `src/css/document.css` | 미리보기와 내보낸 HTML의 문서 서식을 정의한다. HTML의 글꼴 포함 선택, 글꼴 출처와 CSP를 함께 확인한다. |
| `src/css/mdtool.css` | 툴바, 편집기, 대화상자, 반응형 화면 서식. 편집기 자리와 읽기 전용 배경도 여기서 정한다. |
| `src/fonts/` | D2Coding 일반체와 굵은체 로컬 글꼴 파일. |
| `webpack.config.js` | webpack이 브라우저 코드를 `src/dist/mdtool.js` 하나로 번들링한다. `document.css`는 문자열로 읽고 나머지 CSS는 `dist/mdtool.css`로 만든다. Monaco 작업자는 Blob으로 메인 번들에 포함한다. |
| `eslint.config.js` | Node.js 서버·설정 파일, 브라우저 코드, Playwright 검사의 실행 환경별 ESLint 설정이다. |
| `src/dist/` | 빌드 결과물이다. `.gitignore`에서 제외되어 있으므로 결과 파일을 직접 편집하지 않는다. |
| `tests/editor.spec.js` | Playwright Chromium 기능 검사. 실제 화면 계약과 저장 흐름이 바뀌면 검사도 같은 동작을 따르게 갱신한다. |
| `package.json` | 프로젝트 명령과 Node.js 및 패키지 의존성을 관리한다. Node.js 22 이상을 사용한다. |

## 화면과 문서 동작

- 처음 열면 파일명 `notitle`인 빈 Markdown 문서가 편집 모드로 시작한다. 편집 모드에서만 원문을 바꿀 수 있다. 보기와 같이 보기 모드에서는 편집기를 읽기 전용으로 바꾸어 편집을 막는다.
- 원문 편집은 Monaco 편집기가 담당한다. 줄번호와 Markdown 문법 강조는 편집기가 직접 표시하므로 화면에 별도 줄번호 영역을 만들어 겹쳐 보이게 하지 않는다. 편집기 글꼴은 `src/fonts/`의 D2Coding을 사용하고, 문서 상태와 저장에 쓰는 원문은 항상 LF로 읽어 기존 줄바꿈 규칙을 그대로 적용한다.
- 새 문서나 불러온 파일이 현재 편집 내용을 버릴 때는 확인을 표시한다. 원문을 대체하거나 새로 고침하는 경로를 바꾸면 수정 여부 확인도 검토한다.
- 저장 대화상자의 현재 흐름은 **형식 라디오 선택 → 옵션 확인 → 파일 다운로드**다. `save-format`의 `md`, `html`, `pdf` 선택 상태를 읽은 다음 `#download-button`이 저장을 시작한다. HTML일 때만 `#font-option`을 보여 준다. `#embed-fonts`는 기본으로 선택되어 있다.
- PDF는 A4 세로 용지에 담고, 인쇄를 기준으로 삼아 저장 당시의 테마와 관계없이 밝은 테마를 사용한다. 쪽은 최상위 블록 경계에서 나누며 제목 뒤에서는 끊지 않는다. 그림으로 떠 올 때 바깥 자료를 다시 불러올 수 없으므로 글꼴을 담은 독립 문서 HTML을 넘기고, 문서에 있는 이미지는 미리 문서 안에 담는다. Markdown 저장만 수정 표시를 해제하며 HTML과 PDF는 표시를 유지한다.
- `#embed-fonts`가 선택되면 다운로드 HTML에 D2Coding 일반체와 굵은체를 내장하고, 해제되면 jsDelivr의 고정 버전 WOFF2 글꼴을 참조한다. CDN을 참조하는 HTML의 CSP는 `https://cdn.jsdelivr.net` 글꼴 요청을 허용해야 한다. 내장 HTML은 오프라인 사용도 지원한다.
- 새 문서 상태 통계는 UTF-8 바이트와 줄바꿈 뒤의 빈 줄까지 포함하는 줄 수를 표시한다. 문서 인코딩, BOM 및 기존 줄바꿈의 보존 규칙을 변경할 때 README와 회귀 검사를 같이 확인한다.
- Markdown 원문은 신뢰할 수 없는 사용자 입력이다. HTML 변환 결과를 `DOMPurify`로 정리하고 미리보기 iframe의 `sandbox`와 내보낸 문서의 CSP를 유지한다. 사용자 원문을 실행 가능한 스크립트, 이벤트 속성, 위험한 URL로 되살리는 수정을 하지 않는다.
- 미리보기와 저장한 HTML에서 같은 Markdown 렌더링을 사용한다. HTML 저장본은 KaTeX 수식과 Mermaid 그림을 독립적으로 표시한다. 수식·Mermaid 오류가 일반 문서 표시와 저장까지 중단하지 않도록 한다.
- JavaScript는 용량보다 단일 산출물 원칙을 우선한다. Mermaid, PDF, 내장 글꼴 같은 선택 기능도 webpack의 eager 동적 가져오기로 `src/dist/mdtool.js`에 포함한다. 코드를 나눠 별도 JavaScript 청크나 Monaco 작업자 파일을 만들지 않는다.

## 빌드, 실행 및 검사

PowerShell에서는 `npm.cmd`를 사용한다. macOS와 Linux에서는 `npm`을 사용한다. Windows에서 필요한 의존성을 설치하고 개발 서버를 시작하려면 다음을 실행한다.

```powershell
npm.cmd install
npm.cmd start
```

`npm.cmd start`는 `prestart`에 따라 먼저 webpack 브라우저 번들을 빌드한다. 기본 주소는 `http://localhost:9803`이고, 포트가 필요하면 `PORT` 환경 변수로 지정한다. 빌드만 하려면 다음을 실행한다.

```powershell
npm.cmd run build
```

ESLint 검사는 다음 명령으로 실행한다.

```powershell
npm.cmd run lint
```

Chromium 브라우저가 아직 설치되지 않았다면 한 번 설치한 뒤, Playwright 검사 전체를 다음과 같이 실행한다.

```powershell
npx.cmd playwright install chromium
npm.cmd test
```

테스트 설정은 별도 서버를 포트 9804에서 실행한다. 기존 프로세스가 해당 포트를 사용 중이면 서버 실행 검사와의 충돌을 먼저 해결한다. `npm.cmd test`는 ESLint를 먼저 실행한 뒤 webpack 번들과 Playwright 검사를 실행한다. 소스 변경 뒤에는 빌드 결과와 검사 결과를 구분하여 보고하고, 실제로 실행하지 않은 검사를 통과했다고 말하지 않는다.

현재 저장 UI는 형식 라디오와 별도 다운로드 버튼을 사용한다. `tests/editor.spec.js`의 `save()` 보조 함수는 `input[name="save-format"][value="..."]` 선택, HTML 글꼴 옵션 확인, `#download-button` 클릭 순서를 따른다.

PDF 검사는 저장한 파일의 `/MediaBox`와 쪽 수로 확인한다. 그림을 떠 오는 방식이라 본문 글자는 PDF에 남지 않으므로 글자를 찾아 확인하지 않는다.

검사에서 편집기를 다룰 때는 Monaco의 화면 계약을 사용한다. 입력 대상은 `#editor :is(.native-edit-context, textarea.inputarea)`이고, 줄번호는 `#editor .margin-view-overlays .line-numbers`에서 읽는다. 원문을 준비할 때는 `setSource()`처럼 클립보드 붙여넣기를 사용한다. 키 입력으로 여러 줄을 넣으면 편집기의 자동 들여쓰기가 끼어들어 원문이 달라지므로, `playwright.config.js`의 클립보드 권한을 유지한다.

## 반드시 지킬 사항

다음 규칙은 현재 TODO.md 하단의 공통 요구사항이다.

1. 프로젝트 텍스트 파일은 UTF-8로 저장한다. BOM 또는 줄바꿈 형식을 보존해야 하는 파일을 임의로 재인코딩하지 않는다.
2. 사용자에게 작업 결과를 답할 때 한국어를 사용한다. 새 코드 주석과 문서도 한국어로 작성한다. 외부 라이선스 원문, 라이브러리 API, 표준 명칭은 필요한 경우 원래 표기를 유지한다.

기존 파일을 살펴보고 사용자의 변경 내용을 보존한다. 특히 요청하지 않은 코드, TODO, 의존성, 생성물은 덮어쓰거나 되돌리지 않는다. 공개된 브라우저 화면 동작이나 저장 규칙을 바꿀 때는 README와 관련 검사를 현재 계약에 맞춘다.
