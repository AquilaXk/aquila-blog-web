// 참조 구현: silverbulletmd/silverbullet (MIT) — plug-api/lib/tree.ts
// 인라인 코드(`...`), 인라인 수식($...$), 블록 수식($$...$$), 펜스 코드블록 문맥 단일 패스 스캐너

export const FLAG_WHITESPACE = 1 << 0
export const FLAG_SLASH = 1 << 1
export const FLAG_DIGIT = 1 << 2

export const ASCII_FLAGS = new Uint8Array(128)
ASCII_FLAGS[9] |= FLAG_WHITESPACE // \t
ASCII_FLAGS[10] |= FLAG_WHITESPACE // \n
ASCII_FLAGS[13] |= FLAG_WHITESPACE // \r
ASCII_FLAGS[32] |= FLAG_WHITESPACE // ' '
ASCII_FLAGS[47] |= FLAG_SLASH // '/'
for (let c = 48; c <= 57; c += 1) {
  ASCII_FLAGS[c] |= FLAG_DIGIT
}

export const isAsciiWhitespace = (code: number): boolean => {
  return code < 128 ? (ASCII_FLAGS[code]! & FLAG_WHITESPACE) !== 0 : code === 160
}

export const isAsciiWhitespaceOrSlash = (code: number): boolean => {
  return code < 128
    ? (ASCII_FLAGS[code]! & (FLAG_WHITESPACE | FLAG_SLASH)) !== 0
    : code === 160
}

export const hasWhitespaceOrSlash = (text: string): boolean => {
  for (let i = 0; i < text.length; i += 1) {
    if (isAsciiWhitespaceOrSlash(text.charCodeAt(i))) return true
  }
  return false
}

export const isOffsetInsideCodeOrMathContext = (
  markdown: string,
  targetOffset: number
): boolean => {
  if (targetOffset <= 0 || targetOffset > markdown.length) return false

  let i = 0
  const len = Math.min(markdown.length, targetOffset + 1)
  let inFencedCode = false
  let fenceChar = 0
  let fenceLength = 0
  let inBlockMath = false
  let inInlineCode = false
  let inlineCodeTicks = 0
  let inInlineMath = false

  while (i < len) {
    const ch = markdown.charCodeAt(i)

    // 1. 펜스 코드블록 내부인 경우
    if (inFencedCode) {
      if (i >= targetOffset) return true
      if (ch === 10 || ch === 13) {
        // 줄바꿈 후 닫는 펜스 검사
        let next = i + 1
        while (next < len && (markdown.charCodeAt(next) === 32 || markdown.charCodeAt(next) === 9)) {
          next += 1
        }
        let count = 0
        while (next + count < len && markdown.charCodeAt(next + count) === fenceChar) {
          count += 1
        }
        if (count >= fenceLength) {
          inFencedCode = false
          i = next + count
          continue
        }
      }
      i += 1
      continue
    }

    // 2. 블록 수식($$...$$) 내부인 경우
    if (inBlockMath) {
      if (i >= targetOffset) return true
      if (ch === 36 && i + 1 < len && markdown.charCodeAt(i + 1) === 36) {
        // 닫는 $$
        inBlockMath = false
        i += 2
        continue
      }
      i += 1
      continue
    }

    // 3. 인라인 코드(`...`) 내부인 경우
    if (inInlineCode) {
      if (i >= targetOffset) return true
      if (ch === 96) { // `
        let count = 0
        while (i + count < len && markdown.charCodeAt(i + count) === 96) {
          count += 1
        }
        if (count === inlineCodeTicks) {
          inInlineCode = false
          i += count
          continue
        }
        i += count
        continue
      }
      i += 1
      continue
    }

    // 4. 인라인 수식($...$) 내부인 경우
    if (inInlineMath) {
      if (i >= targetOffset) return true
      if (ch === 36 && (i === 0 || markdown.charCodeAt(i - 1) !== 92)) { // $ (not escaped)
        inInlineMath = false
        i += 1
        continue
      }
      i += 1
      continue
    }

    // 일반 상태에서 마커 시작 검사
    // 줄의 시작인지 확인
    const isLineStart = i === 0 || markdown.charCodeAt(i - 1) === 10 || markdown.charCodeAt(i - 1) === 13

    if (isLineStart) {
      let spaceIdx = i
      while (spaceIdx < len && (markdown.charCodeAt(spaceIdx) === 32 || markdown.charCodeAt(spaceIdx) === 9)) {
        spaceIdx += 1
      }
      const markerChar = markdown.charCodeAt(spaceIdx)
      if (markerChar === 96 || markerChar === 126) { // ` or ~
        let count = 0
        while (spaceIdx + count < len && markdown.charCodeAt(spaceIdx + count) === markerChar) {
          count += 1
        }
        if (count >= 3) {
          inFencedCode = true
          fenceChar = markerChar
          fenceLength = count
          i = spaceIdx + count
          if (targetOffset <= i) return true
          continue
        }
      }
    }

    // 블록 수식 $$
    if (ch === 36 && i + 1 < len && markdown.charCodeAt(i + 1) === 36) {
      inBlockMath = true
      i += 2
      if (targetOffset <= i) return true
      continue
    }

    // 인라인 코드 `
    if (ch === 96) {
      let count = 0
      while (i + count < len && markdown.charCodeAt(i + count) === 96) {
        count += 1
      }
      inInlineCode = true
      inlineCodeTicks = count
      i += count
      if (targetOffset <= i) return true
      continue
    }

    // 인라인 수식 $
    if (ch === 36 && (i === 0 || markdown.charCodeAt(i - 1) !== 92)) {
      // 다음 글자가 숫자나 통화 기호가 아니고 공백이 아닌 경우
      if (i + 1 < len && !isAsciiWhitespace(markdown.charCodeAt(i + 1))) {
        inInlineMath = true
        i += 1
        if (targetOffset <= i) return true
        continue
      }
    }

    i += 1
  }

  return inFencedCode || inBlockMath || inInlineCode || inInlineMath
}
