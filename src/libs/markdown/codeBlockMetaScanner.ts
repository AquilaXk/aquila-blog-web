// 참조 구현: vuejs/vitepress (MIT) — src/node/markdown/plugins/preWrapper.ts
// 참조 구현: shikijs/shiki (MIT) — packages/transformers/src/transformers/meta-highlight.ts & meta-highlight-word.ts

export const MAX_HIGHLIGHT_LINE = 16_384
export const MAX_HIGHLIGHT_TOTAL_LINES = 2_000
export const MAX_WORD_PATTERNS = 16
export const MAX_WORD_LENGTH = 128
export const MAX_WORD_MATCHES_PER_BLOCK = 256
export const MAX_TITLE_LENGTH = 160

const BITSET_WORDS_COUNT = MAX_HIGHLIGHT_LINE >>> 5 // 512 words for 16,384 lines

const ASCII_WS = 1
const ASCII_DIGIT = 1 << 1
const ASCII_QUOTE = 1 << 2
const ASCII_SLASH = 1 << 3
const ASCII_ESCAPE = 1 << 4

const ASCII_CLASS_TABLE = (() => {
  const table = new Uint8Array(128)
  table[9] = ASCII_WS // '\t'
  table[32] = ASCII_WS // ' '
  for (let code = 48; code <= 57; code += 1) {
    table[code] = ASCII_DIGIT
  }
  table[34] = ASCII_QUOTE // '"'
  table[39] = ASCII_QUOTE // "'"
  table[47] = ASCII_SLASH // '/'
  table[92] = ASCII_ESCAPE // '\\'
  return table
})()

const popcount32 = (word: number): number => {
  let v = word >>> 0
  v -= (v >>> 1) & 0x55555555
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export class CodeLineBitset {
  readonly words: Uint32Array
  private _size = 0

  static parse(meta: string): CodeLineBitset {
    return parseCodeLineBitset(meta)
  }

  constructor(words?: Uint32Array) {
    this.words = words || new Uint32Array(BITSET_WORDS_COUNT)
    if (words) {
      let total = 0
      for (let i = 0; i < words.length; i += 1) {
        const w = words[i]!
        if (w !== 0) total += popcount32(w)
      }
      this._size = total
    }
  }

  has(line: number): boolean {
    if (line <= 0 || line > MAX_HIGHLIGHT_LINE) return false
    const wordIndex = line >>> 5
    const bitMask = 1 << (line & 31)
    return (this.words[wordIndex]! & bitMask) !== 0
  }

  hasLine(line: number): boolean {
    return this.has(line)
  }

  add(line: number): void {
    if (line <= 0 || line > MAX_HIGHLIGHT_LINE) return
    const wordIndex = line >>> 5
    const bitMask = 1 << (line & 31)
    const prev = this.words[wordIndex]!
    if ((prev & bitMask) === 0) {
      this.words[wordIndex] = prev | bitMask
      this._size += 1
    }
  }

  addRange(start: number, end: number): void {
    const safeStart = Math.max(1, Math.min(start, end))
    const safeEnd = Math.min(MAX_HIGHLIGHT_LINE, Math.max(start, end))
    if (safeStart > safeEnd) return

    const startWord = safeStart >>> 5
    const endWord = safeEnd >>> 5
    const startMask = (0xffffffff << (safeStart & 31)) >>> 0
    const endMask = 0xffffffff >>> (31 - (safeEnd & 31))

    if (startWord === endWord) {
      const mask = (startMask & endMask) >>> 0
      const prev = this.words[startWord]!
      const next = (prev | mask) >>> 0
      if (next !== prev) {
        this._size += popcount32(next ^ prev)
        this.words[startWord] = next
      }
      return
    }

    const firstPrev = this.words[startWord]!
    const firstNext = (firstPrev | startMask) >>> 0
    if (firstNext !== firstPrev) {
      this._size += popcount32(firstNext ^ firstPrev)
      this.words[startWord] = firstNext
    }

    for (let wordIdx = startWord + 1; wordIdx < endWord; wordIdx += 1) {
      const prev = this.words[wordIdx]!
      if (prev !== 0xffffffff) {
        this._size += 32 - popcount32(prev)
        this.words[wordIdx] = 0xffffffff
      }
    }

    const lastPrev = this.words[endWord]!
    const lastNext = (lastPrev | endMask) >>> 0
    if (lastNext !== lastPrev) {
      this._size += popcount32(lastNext ^ lastPrev)
      this.words[endWord] = lastNext
    }
  }

  toSet(): Set<number> {
    const set = new Set<number>()
    if (this._size === 0) return set
    for (let wordIdx = 0; wordIdx < this.words.length; wordIdx += 1) {
      let word = this.words[wordIdx]!
      if (word === 0) continue
      const baseLine = wordIdx << 5
      while (word !== 0) {
        const tz = 31 - Math.clz32(word & -word)
        set.add(baseLine + tz)
        word &= word - 1
      }
    }
    return set
  }

  get size(): number {
    return this._size
  }
}

/**
 * 단일 패스 ASCII 코드포인트 연산({1,3-5})으로 줄 비트셋 파싱 (최대 2,000줄 상한)
 */
export const parseCodeLineBitset = (meta: string): CodeLineBitset => {
  const bitset = new CodeLineBitset()
  if (!meta) return bitset

  let startIndex = 0
  let endIndex = meta.length

  const braceStart = meta.indexOf("{")
  if (braceStart !== -1) {
    const braceEnd = meta.indexOf("}", braceStart)
    if (braceEnd !== -1) {
      startIndex = braceStart + 1
      endIndex = braceEnd
    }
  }

  let currentNum = 0
  let rangeStart = 0
  let hasNum = false

  for (let i = startIndex; i <= endIndex; i += 1) {
    if (bitset.size >= MAX_HIGHLIGHT_TOTAL_LINES) break

    const code = i < endIndex ? meta.charCodeAt(i) : 44 // simulate comma at end
    const asciiFlags = code < 128 ? ASCII_CLASS_TABLE[code]! : 0
    if ((asciiFlags & ASCII_DIGIT) !== 0) {
      // 0-9
      currentNum = currentNum * 10 + (code - 48)
      hasNum = true
    } else if (code === 45) {
      // '-'
      if (hasNum) {
        rangeStart = currentNum
        currentNum = 0
        hasNum = false
      }
    } else if (code === 44 || code === 125 || (asciiFlags & ASCII_WS) !== 0) {
      // ',' or '}' or space
      if (hasNum) {
        if (rangeStart > 0) {
          const budget = MAX_HIGHLIGHT_TOTAL_LINES - bitset.size
          const cappedEnd = Math.min(currentNum, rangeStart + budget - 1)
          if (cappedEnd >= rangeStart) {
            bitset.addRange(rangeStart, cappedEnd)
          }
          rangeStart = 0
        } else {
          bitset.add(currentNum)
        }
        currentNum = 0
        hasNum = false
      }
    }
  }

  return bitset
}

export const parseHighlightedLineNumbers = (meta: string): Set<number> => {
  return parseCodeLineBitset(meta).toSet()
}

/**
 * VitePress [filename.ts] 및 title="...", filename="..." 메타 파싱
 */
export const extractCodeBlockTitle = (meta: string): string => {
  if (!meta) return ""

  // 1. [filename.ts] VitePress 대괄호 구문 스캔 (인용부호 바깥)
  let inQuotes = 0 // 0: none, 34: ", 39: '
  for (let i = 0; i < meta.length; i += 1) {
    const ch = meta.charCodeAt(i)
    if (ch === 92) {
      // escape
      i += 1
      continue
    }
    if (inQuotes === 0) {
      if (ch === 34 || ch === 39) {
        inQuotes = ch
      } else if (ch === 91) {
        // '['
        const closeIdx = meta.indexOf("]", i + 1)
        if (closeIdx > i + 1 && closeIdx - i - 1 <= MAX_TITLE_LENGTH) {
          const title = meta.slice(i + 1, closeIdx).trim()
          if (title) return title
        }
      }
    } else if (ch === inQuotes) {
      inQuotes = 0
    }
  }

  // 2. title="..." 또는 filename="..."
  const titleMatch = /(?:^|\s)(?:title|filename)=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(meta)
  if (titleMatch) {
    const raw = titleMatch[1] || titleMatch[2] || titleMatch[3] || ""
    const trimmed = raw.trim().replace(/^["']|["']$/g, "")
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return trimmed.slice(0, MAX_TITLE_LENGTH)
    }
    return trimmed
  }

  return ""
}

/**
 * Shiki /pattern/ 인라인 단어 하이라이트 토큰 추출
 * 인용부호("")나 대괄호([]) 내부의 슬래시는 무시
 */
export const extractWordHighlightPatterns = (meta: string): string[] => {
  if (!meta || !meta.includes("/")) return []

  const words: string[] = []
  let inQuotes = 0
  let inBrackets = false
  let i = 0

  while (i < meta.length && words.length < MAX_WORD_PATTERNS) {
    const ch = meta.charCodeAt(i)
    const flags = ch < 128 ? ASCII_CLASS_TABLE[ch]! : 0

    if ((flags & ASCII_ESCAPE) !== 0) {
      // escape
      i += 2
      continue
    }

    if (inQuotes === 0 && !inBrackets) {
      if ((flags & ASCII_QUOTE) !== 0) {
        inQuotes = ch
      } else if (ch === 91) {
        inBrackets = true
      } else if ((flags & ASCII_SLASH) !== 0) {
        // '/' 시작
        const prevChar = i > 0 ? meta.charCodeAt(i - 1) : 32
        const prevFlags = prevChar < 128 ? ASCII_CLASS_TABLE[prevChar]! : 0
        // 직전 문자가 공백이나 메타 시작 또는 중괄호/대괄호 끝이어야 함
        if ((prevFlags & ASCII_WS) !== 0 || prevChar === 125 || prevChar === 93 || i === 0) {
          let endSlash = -1
          for (let j = i + 1; j < meta.length; j += 1) {
            const innerCode = meta.charCodeAt(j)
            const innerFlags = innerCode < 128 ? ASCII_CLASS_TABLE[innerCode]! : 0
            if ((innerFlags & ASCII_ESCAPE) !== 0) {
              j += 1
              continue
            }
            if ((innerFlags & ASCII_SLASH) !== 0) {
              endSlash = j
              break
            }
          }
          if (endSlash > i + 1) {
            const rawWord = meta.slice(i + 1, endSlash).trim()
            if (rawWord && rawWord.length <= MAX_WORD_LENGTH) {
              words.push(rawWord)
            }
            i = endSlash + 1
            continue
          }
        }
      }
    } else if (inBrackets && ch === 93) {
      inBrackets = false
    } else if (inQuotes !== 0 && ch === inQuotes) {
      inQuotes = 0
    }

    i += 1
  }

  return words
}

const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * HTML <...> 태그 및 HTML 엔티티(&amp; 등) 바깥의 텍스트에서만 일치 단어를 <mark class="aq-code-word-mark">로 래핑
 */
export const highlightWordsInHtml = (html: string, words: readonly string[]): string => {
  if (!html || !words || words.length === 0) return html

  const validWords = words.filter((w) => Boolean(w && w.trim()))
  if (validWords.length === 0) return html

  const regexPattern = validWords.map(escapeRegExp).join("|")
  const entityOrWordRegex = new RegExp(`(&(?:#\\d+|#x[0-9a-fA-F]+|[a-zA-Z0-9]+);)|(${regexPattern})`, "g")

  const replaceSegment = (segment: string, getRemainingBudget: () => number, consumeMatch: () => void) =>
    segment.replace(entityOrWordRegex, (fullMatch, entityGroup: string | undefined) => {
      if (entityGroup !== undefined) return fullMatch
      if (getRemainingBudget() > 0) {
        consumeMatch()
        return `<mark class="aq-code-word-mark">${fullMatch}</mark>`
      }
      return fullMatch
    })

  let result = ""
  let cursor = 0
  let matchCount = 0
  const getRemainingBudget = () => MAX_WORD_MATCHES_PER_BLOCK - matchCount
  const consumeMatch = () => {
    matchCount += 1
  }

  while (cursor < html.length && matchCount < MAX_WORD_MATCHES_PER_BLOCK) {
    const tagOpen = html.indexOf("<", cursor)
    if (tagOpen === -1) {
      result += replaceSegment(html.slice(cursor), getRemainingBudget, consumeMatch)
      cursor = html.length
      break
    }

    if (tagOpen > cursor) {
      result += replaceSegment(html.slice(cursor, tagOpen), getRemainingBudget, consumeMatch)
    }

    const tagClose = html.indexOf(">", tagOpen)
    if (tagClose === -1) {
      result += html.slice(tagOpen)
      cursor = html.length
      break
    }

    result += html.slice(tagOpen, tagClose + 1)
    cursor = tagClose + 1
  }

  if (cursor < html.length) {
    result += html.slice(cursor)
  }

  return result
}
