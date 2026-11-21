export const ASCII_DIGIT_BIT = 1
export const ASCII_ALPHA_BIT = 2
export const ASCII_ALNUM_BIT = ASCII_DIGIT_BIT | ASCII_ALPHA_BIT
export const ASCII_SPACE_BIT = 4
export const ASCII_PREFIX_BIT = 8

const SINGLE_WHITESPACE_PATTERN = /^\s$/u

export const ASCII_CHAR_FLAGS = (() => {
  const table = new Uint8Array(128)
  for (let code = 48; code <= 57; code += 1) table[code] |= ASCII_DIGIT_BIT
  for (let code = 65; code <= 90; code += 1) table[code] |= ASCII_ALPHA_BIT
  for (let code = 97; code <= 122; code += 1) table[code] |= ASCII_ALPHA_BIT
  for (const code of [9, 10, 11, 12, 13, 32]) table[code] |= ASCII_SPACE_BIT
  for (const code of [40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124]) {
    table[code] |= ASCII_PREFIX_BIT
  }
  return table
})()

export const matchLowerAsciiPrefixAt = (text: string, start: number, lowerLiteral: string): boolean => {
  if (start + lowerLiteral.length > text.length) return false
  for (let i = 0; i < lowerLiteral.length; i += 1) {
    const target = lowerLiteral.charCodeAt(i)
    const ch = text.charCodeAt(start + i)
    if (target >= 97 && target <= 122) {
      if ((ch | 0x20) !== target) return false
    } else if (ch !== target) {
      return false
    }
  }
  return true
}

export const isAsciiDigitCode = (code: number): boolean =>
  (code & ~0x7f) === 0 && (ASCII_CHAR_FLAGS[code]! & ASCII_DIGIT_BIT) !== 0

export const isAsciiAlphaNumericCode = (code: number): boolean =>
  (code & ~0x7f) === 0 && (ASCII_CHAR_FLAGS[code]! & ASCII_ALNUM_BIT) !== 0

export const isAsciiSpaceCode = (code: number): boolean =>
  (code & ~0x7f) === 0 && (ASCII_CHAR_FLAGS[code]! & ASCII_SPACE_BIT) !== 0

export const isAsciiMathPrefixCode = (code: number): boolean =>
  (code & ~0x7f) === 0 && (ASCII_CHAR_FLAGS[code]! & ASCII_PREFIX_BIT) !== 0

export const isUnicodeWhitespaceChar = (ch: string | undefined): boolean => {
  if (!ch) return false
  const code = ch.charCodeAt(0)
  return code < 128 ? (ASCII_CHAR_FLAGS[code]! & ASCII_SPACE_BIT) !== 0 : SINGLE_WHITESPACE_PATTERN.test(ch)
}

export const extractAsciiAlphaNumeric = (text: string): string => {
  let out = ""
  for (let i = 0; i < text.length; i += 1) {
    if (isAsciiAlphaNumericCode(text.charCodeAt(i))) out += text[i]!
  }
  return out
}

export const extractAlphaNumericOutsideAngles = (text: string): string => {
  let out = ""
  let inAngle = false
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code === 60) inAngle = true
    else if (code === 62 || code === 10 || code === 13 || code === 0xe000) inAngle = false
    else if (!inAngle && isAsciiAlphaNumericCode(code)) out += text[i]!
  }
  return out
}
