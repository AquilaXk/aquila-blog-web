# 마크다운 에디터 및 공개 렌더러 아키텍처 의사결정과 트레이드오프

라이브 마크다운 에디터(`src/components/markdown-editor/`)와 공개 마크다운 렌더러(`src/libs/markdown/`)의 파서 정합성, 번들 예산, 보안 경계, 입력 안정성을 다루는 아키텍처 의사결정 기록이다.

## 1. 2패스 CommonMark 구조 마스킹과 번들 예산 보존

**문제 배경.** 공개 상세 페이지(`/posts/[id]`)는 커스텀 블록(`:::callout`, `:::toggle`, `:::bookmark`, `<aside>`, `> [!NOTE]`, 전용 `$$` 수식 펜스, 단독 이미지 행)과 표준 CommonMark 코드 블록 및 리스트를 함께 파싱한다. 초기 구현은 수제 줄 단위 펜스 상태머신(`stepTopLevelCodeFence`)을 사용했으나 리스트 항목 내부의 닫히지 않은 코드 펜스나 HTML 주석(`<!-- ``` -->`)에서 CommonMark §4.5 및 §5.2 규격과 어긋났다. 반대로 에디터 전용 `@lezer/markdown` 파서를 공개 상세 번들에 추가하면 `/posts/[id]` 공유 번들이 `70.5KB`(raw 기준) 증가하여 번들 예산(`586.4KB`)을 초과했다.

**실무 사례 및 대안 비교.**

1. 수제 줄 단위 펜스 상태머신 유지. 번들 증가는 `0B`이지만 CommonMark 컨테이너 연속성(리스트 들여쓰기 펜스 자동 종료, Type 6 HTML 블록 `<aside>`의 빈 줄 종료 규칙)을 재현하려면 수백 줄의 분기가 계속 늘어난다.
2. 공개 렌더러에 `@lezer/markdown` 도입. 에디터와 동일한 파서를 쓰지만 공개 상세 번들에 이미 존재하는 `unified` + `remark-parse` + `remark-gfm`과 중복되어 초기 로드 예산을 위반한다.
3. `remark-parse` + `remark-gfm`에 `remark-math`(`micromark-extension-math`)까지 결합. 닫히지 않은 단독 `$$` 줄이 나오면 `mathFlow` 토크나이저가 문서 끝(EOF)까지 삼켜 이후의 모든 코드 블록 범위를 잃어버린다.
4. `remark-parse` + `remark-gfm` 기반 지연 2패스 등길이 마스킹(`\n#` + 공백). 이미 공개 번들에 포함된 파서만 재사용하면서 확정된 커스텀 블록 경계를 동일 UTF-16 길이의 빈 줄과 ATX 헤딩(`\n#` + 공백)으로 치환해 재파싱한다.

**최종 결정과 트레이드오프.** 대안 4를 채택하고 `stepTopLevelCodeFence`와 `ActiveCodeFence`를 삭제했다(`src/libs/markdown/commonMarkCodeBlockRanges.ts`, `src/libs/markdown/renderingDirectiveModel.ts`). 확정된 커스텀 블록을 `"\n#" + " ".repeat(len - 2)`로 마스킹하면 UTF-16 바이트 오프셋이 100% 보존되면서 앞선 문단과 Type 6 HTML 블록(`<aside>`, `<div>`)은 빈 줄(`\n\n`)로 종료되고, 앞선 리스트와 인용구는 열 0의 ATX 헤딩(`#`)으로 종료되며, 직후에 오는 4칸 들여쓰기 줄은 지연 문단 연속(lazy continuation) 대신 정식 `code` 블록으로 인식된다. 커스텀 블록 마커가 있는 문서에서만 최대 1~2회 추가 파싱이 발생하는 작은 CPU 비용을 감수하는 대신 공개 번들 증가 `0B`와 CommonMark 100% 정합성을 확보했다.

## 2. Pandoc `tex_math_dollars`와 `micromark-extension-math` 수식 경계 단일화

**문제 배경.** 평문 통화 표기(`$10 and $20`), 셸 변수(`$HOME`), 쿼리 URL(`https://example.com/?a=$$&b=1`), 인라인 코드 내부의 `$$`가 수식으로 오인되거나, 반대로 닫히지 않은 전용 `$$` 줄이 `remark-math`의 `mathFlow`를 발동해 후속 마크다운 헤딩과 문단을 삼키는 문제가 있었다.

**실무 사례 및 대안 비교.**

1. 단순 정규식 기반 `$` 이스케이프. 구현이 짧지만 백틱 코드 스팬, HTML 블록, 자동링크, 중첩 중괄호(`{{color:blue|$x^{2}$}}`) 내부의 `$`를 구분하지 못한다.
2. Pandoc `tex_math_dollars` 규칙과 `micromark-extension-math`의 `mathFlow` 개방 규칙을 결합한 단일 스캐너(`src/libs/markdown/pandocMathScanner.ts`).

**최종 결정과 트레이드오프.** 대안 2를 채택했다. 줄 시작(최대 3칸 공백 및 `>` 인용 프리픽스 허용, 4칸 공백·탭 제외)에 위치한 `$$` 뒤에 같은 줄의 `$`가 없으면 `micromark-extension-math`가 무조건 `mathFlow`로 진입하므로, 동일한 `quoteDepth`에서 닫히는 전용 `$$` 줄이 없을 때는 인라인 `$$...$$` 탐색으로 폴스루하지 않고 즉시 무효화해 `\$\$`로 이스케이프한다. 비전용 인라인 `$$...$$`는 같은 문단 안에서만 매칭하되 인라인 코드 스팬, HTML 주석, HTML 블록, URL, 링크 목적지 내부의 `$$`를 건너뛰거나 중단하도록 고정했다.

## 3. 정규식 없는 영숫자 센티넬 프로빙과 정적 분석(CodeQL·SonarCloud) 호환

**문제 배경.** 인라인 HTML 정규화(`inlineHtmlNormalization.ts`)와 이스케이프 기호 보호(`inlineMathGuardModel.ts`)는 임시 유니코드 PUA 센티넬(`\uE000...\uE001`)을 사용한다. 문서 원문에 동일한 문자열이나 수치 엔티티(`&#xE000;`)가 포함될 때 충돌을 피하기 위해 `.replace(/(?:<[^>]*>|\s)+/g, "")`로 태그를 제거해 프로빙했으나, CodeQL `js/incomplete-multi-character-sanitization`(`#71`) 및 SonarCloud `S8786` 경고가 발생했고 속성 내부의 `&#62;`(`>`)나 명명 엔티티 `&lowbar;`(`_`), 마크다운 이스케이프 `\_`를 통한 우회 가능성이 남았다.

**실무 사례 및 대안 비교.**

1. 다중 패스 정규식 태그 제거 루프. 유한 패스로는 중첩·인코딩된 태그 경계를 완벽히 제거하기 어렵고 정적 보안 스캐너가 HTML 새니타이저 오용으로 분류한다.
2. 암호학적 랜덤 UUID 센티넬. 순수 함수 결정론과 스냅샷 테스트 재현성을 해칠 수 있다.
3. 밑줄(`_`)을 제거한 순수 영숫자 센티넬 코어(`AQCODE${nonce}N${idx}E`, `aqp${nonce}z{eq|lt|lb|rb|ent<k>e}`)와 문자 코드(charCode) 스캔 기반 프로빙(`extractAsciiAlphaNumeric`, `extractAlphaNumericOutsideAngles`).

**최종 결정과 트레이드오프.** 대안 3을 채택했다. HTML5의 어떤 명명 엔티티도 ASCII 영숫자(`[0-9A-Za-z]`)로 디코딩되지 않으며, CommonMark 백슬래시 이스케이프 또한 ASCII 영숫자 앞에서는 동작하지 않는다. 따라서 센티넬 본문을 순수 영숫자로 구성하고 원문 및 수치 엔티티 디코딩 문자열에서 정규식 없이 영숫자만 추출해 부분 문자열 포함 여부를 검사하면, 빈 태그(`<b></b>`), 속성 내 인코딩된 `&#62;`, HTML 주석(`<!-- -->`), 마크다운 이스케이프를 통한 모든 센티넬 합성 충돌을 $O(N)$에 원천 차단하면서 CodeQL과 SonarCloud 경고를 0건으로 유지할 수 있다.

## 4. 라이브 에디터 수식 내부 미짝구분자 오염 복구와 선택적 Lezer 재파싱

**문제 배경.** CodeMirror 6의 `@lezer/markdown` 파서는 Pandoc 수식 토크나이저를 내장하지 않는다. 따라서 유효한 수식 블록(`$$\n\`a'\n$$` 또는 `$$\n<!--\n$$`) 내부에 짝이 맞지 않는 백틱(`` ` ``)이나 HTML 주석 시작(`<!--`)이 들어 있으면, Lezer가 수식 종료(`$$`) 이후 본문의 백틱이나 표·문단까지 하나의 `InlineCode` 또는 `CommentBlock`으로 묶어 후속 인라인 코드 장식, 수식 위젯, 표 위젯이 깨진다.

**실무 사례 및 대안 비교.**

1. `@lezer/markdown` 커스텀 인라인·블록 확장 작성. Lezer 내부 블록/인라인 우선순위와 GFM 확장을 모두 재구성해야 하며, 문단 중간의 다중 행 `$$...$$`까지 Lezer 문법만으로 일치시키기 어렵다.
2. 모든 키스트로크마다 문서를 무조건 2회 파싱. 일반 문서(99.99% 이상)에서 불필요한 파싱 비용이 2배로 든다.
3. 오염 감지 시에만 수행하는 선택적 오프셋 보존 마스킹 재파싱(`findFirstPoisoningMathSpec` + `maskMathSpanPreservingOffsets`).

**최종 결정과 트레이드오프.** 대안 3을 채택했다(`src/components/markdown-editor/markdownEditorMathModel.ts`, `src/components/markdown-editor/markdownEditorLivePreview.ts`). 1차 Lezer 파싱과 수식 스캔 직후, 확정된 수식 범위 `[spec.from, spec.to)` 내부에서 시작해 `spec.to` 바깥으로 삐져나가는 Lezer 리터럴 노드가 존재하는지 $O(M \log N)$ 이진 탐색으로 확인한다. 일반 문서에서는 즉시 `null`을 반환해 추가 비용이 `0`이며, 오염이 감지된 희소 케이스에서만 해당 수식 구간을 줄바꿈과 UTF-16 오프셋을 보존한 안전 문자로 마스킹해 `fallbackMarkdownParser.parse`로 `syntaxRoot`를 복구한다.

## 5. CodeMirror 6 인라인 래퍼 마크 보존과 컨테이너 마크 슬라이싱

**문제 배경.** Obsidian Live Preview 스타일의 CodeMirror 6 표면에서 `==$x^{2}$==`나 `{{color:blue|$x^{2}$}}`처럼 인라인 하이라이트·색상 내부에 전체가 수식 위젯(`Decoration.replace`)으로 치환될 때, 동일한 `[contentFrom, contentTo]` 범위를 가진 `Decoration.mark`를 충돌로 간주해 제거하면 배경 하이라이트와 색상이 사라졌다. 반대로 인용구(`> `)나 리스트(`- `) 내부에 다중 행 수식 블록 위젯이 들어갈 때 `cm-live-quote`/`cm-live-list` 마크 전체를 버리면 위젯 앞뒤 줄의 인용구 보더와 리스트 들여쓰기 스타일이 소실되었다.

**실무 사례 및 대안 비교.**

1. `highlight`와 `inline-color` 마크 범위를 구분자 포함 `[from, to]`로 확장. 비활성 줄에서는 동작하지만 커서가 진입해 구분자가 노출될 때 `==` 기호까지 하이라이트되며 기존 단위 테스트 계약(`from: highlightStart + 2, to: highlightEnd - 2`)을 깨뜨린다.
2. CodeMirror 6 `RangeSet`의 동일 구간 중첩 규칙을 활용해 단행 인라인 위젯에 한해 `highlight`/`inline-color`의 동일 경계(`r.from >= specFrom && r.to <= checkTo`)를 허용하고, `quote`/`list` 컨테이너 마크는 블록·다중 행 위젯 구간(`blockOrMultiLineReplaced`)을 기준으로 앞뒤 슬라이스로 분할(`appendSlicedContainerDecorations`).

**최종 결정과 트레이드오프.** 대안 2를 채택했다(`src/components/markdown-editor/markdownEditorMathModel.ts`, `src/components/markdown-editor/markdownEditorLiveSurfaceDecorations.ts`). 또한 Lezer가 인용구나 리스트 끝에 붙은 열 0의 전용 `$$\n...\n$$` 블록을 지연 연속(lazy continuation)으로 흡수한 경우에는 `resolveBlockNodeEndWithMath`로 컨테이너 끝 오프셋을 수식 시작 전으로 절단하여, 짧은 콜아웃(`> [!NOTE] Short\n$$\nx = 1\n$$`) 뒤에 빈 인용구 줄이 남지 않으면서도 인용구·리스트 내부의 다중 행 수식(`> Before\n> $$\n> x = 1\n> $$\n> After`) 앞뒤로는 스타일이 유지되게 했다.

## 6. 과검증 방지 및 비례적 검증(Proportional Verification) 원칙

**문제 배경.** 순수 TypeScript 파서·모델·단위 테스트만 수정하는 반복 라운드마다 로컬에서 전체 Next.js 프로덕션 빌드(`yarn build`), 번들 예산 측정(`yarn check:bundle-size`), 전체 브라우저 E2E 스위트를 매번 재실행하면 피드백 루프가 수십 분씩 지연되고 시스템 부하가 누적된다.

**최종 결정과 트레이드오프.** `docs/AGENT-CONTEXT.md`의 최소 결정론적 검증 원칙에 따라 로컬에서는 변경된 계약을 직접 증명하는 가장 빠르고 결정론적인 검사(`yarn check:refactor-boundaries`, `yarn check:design-colors`, `yarn contracts:check`, `yarn type-check`, `yarn lint`, `yarn test:unit`)만 직렬로 실행하고, 전체 프로덕션 빌드·번들 예산·E2E 회귀 게이트는 원격 GitHub Actions CI(`Web CI`, `Web Security`, `CodeQL`, `SonarCloud`)가 커밋당 1회 검증하도록 역할을 분리했다. 또한 `pstack interrogate` 리뷰 판정 시 `lead-judgment.md`의 Nitpick Gravity 및 Hypothetical vs. Actual 기준을 엄격히 적용해 실제 버그·보안·유지보수 결함만 `Act On`으로 분류하고 사소한 취향 차이나 비현실적 가설은 `Noted` 또는 `Dismissed`로 판정해 불필요한 재작업 루프를 차단한다.
