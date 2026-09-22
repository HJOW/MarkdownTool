# Markdown Tool

웹 기반 Markdown (md) 편집 프로그램입니다.
웹 브라우저로 페이지에 접속한 후, md 파일을 불러오고, 편집하고, 저장할 수 있습니다.
이 프로그램의 핵심 동작은 모두 웹 브라우저 안에서 수행합니다.

같이 첨부된 서버 소스는 테스트 목적으로 웹 페이지를 단순히 서비스하는 용도로만 사용됩니다.

## 바로 이용

다음 URL로 접속하여 바로 이용하실 수 있습니다.
[https://hjow.github.io/MarkdownTool/src/](https://hjow.github.io/MarkdownTool/src/)

## 사용 방법

1. 처음 접속하면 빈 `notitle` 문서가 편집 모드로 열립니다.
2. **편집**에서 Markdown 원문을 입력합니다. 편집기는 왼쪽에 줄번호를, 본문에는 Markdown 문법 강조를 표시합니다. `Ctrl+F`로 찾기, `Ctrl+Z`와 `Ctrl+Y`로 되돌리기와 다시 실행을 사용할 수 있습니다.
3. **보기**에서는 변환된 HTML을, **같이 보기**에서는 원문과 HTML을 좌우로 확인합니다. **같이 보기**에서는 왼쪽 원문을 그대로 고칠 수 있고, 입력이 잠시 멈추면 오른쪽 미리보기가 따라 갱신됩니다. **보기**에서만 편집이 불가능합니다. 어느 모드에서든 미리보기의 작업 목록 체크박스는 읽기 전용이며, 링크와 접힌 영역은 열 수 있습니다.
4. **파일 불러오기**에서 UTF-8로 저장된 `.md` 또는 `.markdown` 파일을 선택합니다. 기존 파일명은 기억하며 불러온 문서는 편집 모드로 열립니다.
5. **저장**을 누르고 레이어 창에서 Markdown, HTML, PDF 중 형식을 고릅니다. HTML을 고르면 표시되는 **글꼴 포함**을 선택할 수 있습니다. 형식과 옵션을 정한 뒤 **파일 다운로드**를 누릅니다. 취소 버튼이나 Esc 키로 창을 닫을 수 있습니다. `Ctrl+S` 또는 `⌘+S`로도 저장 창을 엽니다.
6. 하단에는 현재 원문의 줄 수, UTF-8 바이트 수, 캐릭터셋이 표시됩니다. **다크 모드 / 밝기 모드** 버튼으로 테마를 전환합니다.

새로 만들기는 원문과 HTML 미리보기를 비우고 파일명을 `notitle`로 되돌립니다. 저장하지 않은 수정 사항이 있는 상태에서 새로 만들거나 다른 파일을 불러오면 내용을 버릴지 확인합니다. 창을 닫거나 새로고침할 때도 브라우저가 지원하는 변경 사항 확인을 요청합니다. 문서 자동 복구 기능은 없습니다.

테마는 처음에는 브라우저의 밝기 설정을 따르고, 사용자가 바꾸면 해당 브라우저에 기억합니다. 브라우저 저장소가 차단된 경우에도 테마 전환은 사용할 수 있습니다.

## 로컬 서버 실행 방법

Node.js 22 이상과 npm이 필요합니다. 프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
npm.cmd install
npm.cmd start
```

브라우저에서 [http://localhost:9803](http://localhost:9803)에 접속합니다. `npm.cmd start`는 브라우저용 스크립트를 먼저 빌드한 뒤 서버를 실행합니다. macOS와 Linux에서는 `npm.cmd` 대신 `npm`을 사용합니다.

다른 포트를 사용하려면 PowerShell에서 다음과 같이 지정합니다.

```powershell
$env:PORT = "8080"
npm.cmd start
```

브라우저용 결과물만 생성하려면 `npm.cmd run build`를 실행합니다. webpack은 화면 JavaScript와 Monaco 작업자를 `src/dist/mdtool.js` 한 파일에 담고, 화면 CSS는 `src/dist/mdtool.css`로 만듭니다. Mermaid, PDF, HTML 글꼴 포함 기능도 JavaScript 파일에 포함하므로 번들 크기는 큽니다. 이후 `src` 폴더를 웹 루트로 제공하는 정적 웹 서버에서도 실행할 수 있습니다. `index.html`을 파일로 직접 열기보다는 HTTP 서버를 통해 접속해 주세요. 설치와 빌드가 끝나면 편집기의 서식 처리에 CDN 연결은 필요하지 않습니다.

## 저장과 문서 정보

- 저장 파일명은 기존 파일명의 마지막 확장자를 바꿔 만듭니다. 예를 들어 `회의.초안.md`는 `회의.초안.html` 또는 `회의.초안.pdf`로 저장됩니다. 새 문서는 `notitle.md`, `notitle.html`, `notitle.pdf`로 저장됩니다.
- 앱은 브라우저에 파일명과 다운로드를 요청합니다. 저장 위치나 파일명을 묻는 창의 표시 여부는 브라우저의 다운로드 설정을 따릅니다. 자동 다운로드로 설정되어 있다면 대화상자 없이 저장될 수 있습니다.
- Markdown은 UTF-8로 저장합니다. 불러온 파일의 BOM은 보존합니다. 수정하지 않은 원문은 줄바꿈을 포함하여 그대로 저장하며, 수정하면 기존 파일에서 선택한 줄바꿈 형식(CRLF 우선, 단독 CR 또는 LF)을 적용합니다. 새 문서는 BOM 없는 UTF-8과 LF를 사용합니다.
- 빈 문서도 편집기 기준으로 1줄입니다. 공백만 있는 줄과 마지막 줄바꿈 뒤의 빈 줄을 포함합니다. 용량은 현재 원문을 Markdown으로 저장할 때의 UTF-8 바이트 수이며, BOM이 있으면 포함합니다. HTML 저장본의 용량과는 다릅니다.
- Markdown 다운로드를 요청하면 수정 표시를 해제합니다. 브라우저에서 실제 다운로드를 취소했는지까지는 앱이 확인할 수 없습니다. HTML과 PDF 내보내기는 원문 저장을 대체하지 않으므로 수정 표시를 유지합니다.
- PDF 저장본은 A4 세로 용지에 10mm 여백으로 담습니다. 문단, 표, 코드 블록 같은 덩어리 경계에서 쪽을 나누므로 문장이 중간에서 잘리지 않으며, 제목만 남기고 쪽이 넘어가지 않습니다. PDF 형식을 고르면 밝기 모드와 다크 모드 중 저장본의 테마를 고를 수 있으며, 이 선택은 PDF 파일에만 적용되고 화면과 미리보기 테마는 바꾸지 않습니다.
- PDF는 화면에 보이는 문서를 그림으로 담습니다. 글꼴, 표, 코드 강조, 수식, Mermaid 그림이 화면과 같게 나오지만 본문 글자를 선택하거나 찾기로 검색할 수는 없습니다. 문서에 넣은 이미지는 PDF 안에 함께 담으며, 가져올 수 없는 주소의 이미지는 빈 자리로 남습니다. 문서가 길면 용량이 커지고 저장에 시간이 걸립니다.
- HTML 저장본에는 전체 문서 구조와 CSS, 수식 글꼴, 렌더링한 Mermaid SVG가 포함됩니다. **글꼴 포함**은 기본 선택이며 해제하면 D2Coding 일반체와 굵은체를 jsDelivr CDN에서 불러오므로 문서를 볼 때 인터넷 연결이 필요합니다. 포함을 선택한 문서는 오프라인에서도 D2Coding을 사용합니다. 두 경우 모두 별도 JavaScript 없이 브라우저에서 열 수 있으며 저장 당시의 테마를 사용합니다. 외부 이미지와 링크는 주소를 유지하므로 별도 네트워크 연결이나 파일이 필요할 수 있습니다.

## Markdown 지원 범위

TODO에 지정된 [GitHub 쓰기 빠른 시작](https://docs.github.com/ko/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github), [기본 서식 문법](https://docs.github.com/ko/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax), [수학 식](https://docs.github.com/ko/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)을 기준으로 다음 기능을 지원합니다.

| 종류 | 지원 내용 |
| --- | --- |
| 기본 문법 | 제목, 강조, 굵게, 취소선, 인용, 중첩 목록, 수평선, 링크, 이미지, 이스케이프 |
| GitHub 형식 | 표와 열 정렬, 읽기 전용 작업 목록, URL 자동 링크, 제목 앵커와 중복 제목 번호 |
| 고급 서식 | 각주, 이모지 단축어, `NOTE`·`TIP`·`IMPORTANT`·`WARNING`·`CAUTION` 알림 상자 |
| HTML 서식 | `details`/`summary` 접힌 영역, `picture`/`source` 이미지, `sub`/`sup`/`ins`/`kbd` 등 |
| 코드 | 언어 이름을 지정한 코드 블록의 구문 강조. 알 수 없는 언어는 일반 코드로 표시 |
| 수식 | `$수식$`, 달러와 백틱으로 감싼 인라인 수식, `$$수식$$`, `math` 코드 블록 |
| 다이어그램 | `mermaid` 코드 블록의 흐름도, 시퀀스 다이어그램 등 |

일반 줄바꿈은 GitHub의 `.md` 파일처럼 같은 문단으로 처리합니다. 명시적 줄바꿈에는 줄 끝 공백 두 개, 역슬래시 또는 `<br>`를 사용합니다.

수식은 KaTeX가 지원하는 LaTeX 문법을 사용합니다. Mermaid 문법 오류가 있으면 해당 코드와 안내를 표시하고 나머지 문서는 계속 표시합니다. GitHub 계정 언급, 이슈·PR 자동 조회, GeoJSON/TopoJSON 지도 및 STL 3D 모델 뷰어는 제공하지 않습니다. 지도·모델 코드 블록은 일반 코드로 표시합니다.

문서에 포함된 스크립트, 이벤트 속성, 임의 스타일, 폼 등은 HTML 변환에서 제거합니다. 미리보기는 별도 iframe에 표시하며, 미리보기와 저장한 HTML 모두 스크립트를 실행하지 않습니다. 이 처리는 Markdown 원문을 바꾸지 않습니다.

파일 선택으로 접근할 수 있는 것은 선택한 Markdown 파일뿐입니다. 같은 폴더의 이미지나 다른 문서는 자동으로 읽어오지 않습니다. 상대 이미지·링크는 미리보기에서는 웹 주소를, 저장본에서는 저장한 HTML의 위치를 기준으로 해석하며, 필요한 파일은 해당 위치에 별도로 준비해야 합니다.

## 개발 구성

| 경로 | 역할 |
| --- | --- |
| `index.js` | Express 정적 웹 서버, 기본 포트 9803 |
| `src/index.html` | 툴바, 원문 영역, 미리보기, 저장 레이어의 기본 구조 |
| `src/js/mdtool.js` | 문서 상태, 파일 입출력, Markdown 변환, 모드·테마 전환, 저장 형식과 글꼴 옵션 |
| `src/js/markdown-editor.js` | 원문 편집에 쓰는 Monaco 편집기 설정, 문법 강조와 줄번호, 편집기 테마 |
| `src/js/pdf-export.js` | PDF 저장. 문서를 숨긴 iframe에 그려 A4 쪽으로 나누어 담기 |
| `src/js/embedded-document-fonts.js` | 글꼴 포함 HTML 저장을 선택했을 때 D2Coding 파일을 CSS에 삽입 |
| `src/css/mdtool.css` | 편집기 화면과 반응형 레이아웃 |
| `src/css/document.css` | 미리보기와 저장한 HTML의 공통 문서 서식 |
| `webpack.config.js` | webpack 단일 JavaScript 번들, CSS 추출, Monaco Blob 작업자, 수식 글꼴 자료 설정 |
| `eslint.config.js` | Node.js 서버·설정, 브라우저 코드, Playwright 검사의 실행 환경별 ESLint 규칙 |
| `src/dist` | 빌드 결과물. 자동 생성하며 Git 추적에서 제외 |
| `tests/editor.spec.js` | 실제 Chromium 브라우저에서 실행하는 기능 회귀 검사 |

앱 화면과 원문 편집 영역, 미리보기, HTML 저장본의 전체 글꼴은 `src/fonts/`의 D2Coding으로 맞췄습니다. 글꼴 파일을 변환 결과에 포함해 내보낸 HTML도 D2Coding 파일 경로나 네트워크에 의존하지 않습니다. 원문 편집에는 Monaco 편집기를 사용합니다. 줄번호와 Markdown 문법 강조는 편집기가 직접 표시하므로 화면에 별도 줄번호 영역을 두지 않습니다. 편집기에는 글꼴, 줄 높이, 가로 넘김, 자동 묶음 기호 넣지 않기 등 기존 편집 방식에 맞춘 설정만 적용하고, 편집에 필요한 기능만 골라 담았습니다. 보기 모드에서는 편집기를 읽기 전용으로 바꾸고 배경색으로 구분합니다. Markdown 변환에는 markdown-it과 확장 플러그인, HTML 정리에는 DOMPurify, 코드 강조에는 highlight.js, 수식에는 KaTeX, 다이어그램에는 Mermaid를 사용합니다. PDF 저장에는 [jsPDF](https://github.com/parallax/jsPDF)와 html2canvas를 사용하며, 브라우저가 문서를 직접 그린 결과를 쪽마다 배치합니다. webpack 단일 번들 정책에 따라 Mermaid, HTML 글꼴 포함, PDF 변환 코드는 필요할 때 실행되지만 다운로드는 첫 화면에서 함께 이뤄집니다.

## 검사 방법

처음 한 번 테스트 브라우저를 설치한 뒤 검사를 실행합니다.

```powershell
npx.cmd playwright install chromium
npm.cmd test
```

코드 품질만 따로 확인하려면 다음을 실행합니다.

```powershell
npm.cmd run lint
```

검사는 빌드 후 포트 9804에서 임시 서버를 실행합니다. 빈 문서와 UTF-8 통계, 줄번호와 Markdown 문법 강조, 모드별 편집 제한, 고급 서식, 위험한 HTML 제거, 파일 입출력, BOM·줄바꿈 보존, 저장 취소, 오프라인 HTML 열기, PDF 쪽 나누기, 테마, 좁은 화면 및 정적 파일 제공 범위를 확인합니다. 다운로드 창 자체의 모양과 저장 위치는 브라우저 및 운영체제 설정을 따릅니다.

## 라이선스

이 프로젝트는 **Apache License 2.0 (Apache-2.0)**에 따라 배포합니다. 조건은 [공식 라이선스 전문](https://www.apache.org/licenses/LICENSE-2.0)을 참고하세요. 사용한 외부 패키지와 글꼴에는 각각의 라이선스가 적용됩니다.
