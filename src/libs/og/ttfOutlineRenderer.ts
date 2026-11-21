// 참조 구현: opentypejs/opentype.js (MIT, Copyright (c) 2020 Frederik De Bleser, src/tables/cmap.mjs)
// TrueType sfnt/cmap 이진 탐색 조회, 글리프 폭 기반 줄바꿈 및 SVG <path> 직렬화
import {
  ContourBuilder,
  decodeGlyphContoursInto,
  OP_CLOSE,
  OP_LINE,
  OP_MOVE,
  OP_QUAD,
  type GlyfTableContext,
} from "./ttfGlyfDecoder"

const SFNT_TRUETYPE_SIGNATURE = 0x00010000
const SFNT_TRUE_APPLE_SIGNATURE = 0x74727565
const MAX_TABLES = 64
const MAX_GLYPH_CACHE_ENTRIES = 4096

type TableSlice = { offset: number; length: number }

type ParsedGlyph = {
  advanceWidth: number
  ops: Uint8Array
  coords: Float32Array
}

export class TrueTypeOutlineFont {
  readonly unitsPerEm: number
  readonly ascent: number
  readonly descent: number
  private readonly view: DataView
  private readonly byteLength: number
  private readonly numberOfHMetrics: number
  private readonly numGlyphs: number
  private readonly hmtxOffset: number
  private readonly glyfContext: GlyfTableContext
  private readonly cmapFormat12Offset: number
  private readonly cmapFormat4Offset: number
  private readonly glyphCache = new Map<number, ParsedGlyph>()

  constructor(buffer: Uint8Array) {
    if (buffer.byteLength < 64) {
      throw new Error("TrueType font buffer is truncated")
    }
    this.byteLength = buffer.byteLength
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    const signature = this.view.getUint32(0)
    if (signature !== SFNT_TRUETYPE_SIGNATURE && signature !== SFNT_TRUE_APPLE_SIGNATURE) {
      throw new Error(`Unsupported sfnt signature: 0x${signature.toString(16)}`)
    }

    const numTables = this.view.getUint16(4)
    if (numTables === 0 || numTables > MAX_TABLES || 12 + numTables * 16 > this.byteLength) {
      throw new Error("Invalid TrueType table directory")
    }

    const tables = new Map<string, TableSlice>()
    for (let i = 0; i < numTables; i += 1) {
      const entryOffset = 12 + i * 16
      const tag = String.fromCharCode(
        buffer[entryOffset],
        buffer[entryOffset + 1],
        buffer[entryOffset + 2],
        buffer[entryOffset + 3]
      )
      const offset = this.view.getUint32(entryOffset + 8)
      const length = this.view.getUint32(entryOffset + 12)
      if (offset + length > this.byteLength) {
        throw new Error(`TrueType table out of bounds: ${tag}`)
      }
      tables.set(tag, { offset, length })
    }

    const head = this.requireTable(tables, "head", 54)
    const hhea = this.requireTable(tables, "hhea", 36)
    const maxp = this.requireTable(tables, "maxp", 6)
    const hmtx = this.requireTable(tables, "hmtx", 4)
    const loca = this.requireTable(tables, "loca", 4)
    const glyf = this.requireTable(tables, "glyf", 2)
    const cmap = this.requireTable(tables, "cmap", 4)

    this.unitsPerEm = this.view.getUint16(head.offset + 18)
    const indexToLocFormat = this.view.getInt16(head.offset + 50)
    if (this.unitsPerEm < 16 || (indexToLocFormat !== 0 && indexToLocFormat !== 1)) {
      throw new Error("Malformed TrueType head metrics")
    }

    this.ascent = this.view.getInt16(hhea.offset + 4)
    this.descent = this.view.getInt16(hhea.offset + 6)
    this.numberOfHMetrics = this.view.getUint16(hhea.offset + 34)
    this.numGlyphs = this.view.getUint16(maxp.offset + 4)
    if (this.numberOfHMetrics === 0 || this.numGlyphs === 0 || hmtx.length < this.numberOfHMetrics * 4) {
      throw new Error("Malformed TrueType horizontal metrics")
    }

    this.hmtxOffset = hmtx.offset
    this.glyfContext = {
      view: this.view,
      numGlyphs: this.numGlyphs,
      indexToLocFormat,
      locaOffset: loca.offset,
      locaLength: loca.length,
      glyfOffset: glyf.offset,
      glyfLength: glyf.length,
    }

    const { format12Offset, format4Offset } = this.locateUnicodeCmapSubtables(cmap)
    if (format12Offset === 0 && format4Offset === 0) {
      throw new Error("TrueType font lacks Unicode cmap format 4/12")
    }
    this.cmapFormat12Offset = format12Offset
    this.cmapFormat4Offset = format4Offset
  }

  private requireTable(tables: Map<string, TableSlice>, tag: string, minBytes: number): TableSlice {
    const slice = tables.get(tag)
    if (!slice || slice.length < minBytes) {
      throw new Error(`Missing or truncated TrueType table: ${tag}`)
    }
    return slice
  }

  private locateUnicodeCmapSubtables(cmap: TableSlice): { format12Offset: number; format4Offset: number } {
    const numSubtables = this.view.getUint16(cmap.offset + 2)
    let format12Offset = 0
    let format4Offset = 0
    const maxEntries = Math.min(numSubtables, 32)
    for (let i = 0; i < maxEntries; i += 1) {
      const rec = cmap.offset + 4 + i * 8
      if (rec + 8 > cmap.offset + cmap.length) break
      const platformId = this.view.getUint16(rec)
      const encodingId = this.view.getUint16(rec + 2)
      const subOffset = cmap.offset + this.view.getUint32(rec + 4)
      if (subOffset + 6 > cmap.offset + cmap.length) continue
      const isUnicode =
        platformId === 0 || (platformId === 3 && (encodingId === 1 || encodingId === 10))
      if (!isUnicode) continue
      const format = this.view.getUint16(subOffset)
      if (format === 12 && format12Offset === 0 && subOffset + 16 <= cmap.offset + cmap.length) {
        format12Offset = subOffset
      } else if (format === 4 && format4Offset === 0 && subOffset + 14 <= cmap.offset + cmap.length) {
        format4Offset = subOffset
      }
    }
    return { format12Offset, format4Offset }
  }

  private lookupGlyphId(codePoint: number): number {
    if (this.cmapFormat12Offset !== 0) {
      const numGroups = this.view.getUint32(this.cmapFormat12Offset + 12)
      const groupsBase = this.cmapFormat12Offset + 16
      let low = 0
      let high = numGroups - 1
      while (low <= high) {
        const mid = (low + high) >>> 1
        const groupOffset = groupsBase + mid * 12
        if (groupOffset + 12 > this.byteLength) break
        const startChar = this.view.getUint32(groupOffset)
        if (codePoint < startChar) {
          high = mid - 1
          continue
        }
        const endChar = this.view.getUint32(groupOffset + 4)
        if (codePoint > endChar) {
          low = mid + 1
          continue
        }
        const startGlyphId = this.view.getUint32(groupOffset + 8)
        const gid = startGlyphId + (codePoint - startChar)
        return gid < this.numGlyphs ? gid : 0
      }
      return 0
    }

    if (this.cmapFormat4Offset !== 0 && codePoint <= 0xffff) {
      const segCount = this.view.getUint16(this.cmapFormat4Offset + 6) >>> 1
      const endCountBase = this.cmapFormat4Offset + 14
      const startCountBase = endCountBase + segCount * 2 + 2
      const idDeltaBase = startCountBase + segCount * 2
      const idRangeOffsetBase = idDeltaBase + segCount * 2
      let low = 0
      let high = segCount - 1
      while (low <= high) {
        const mid = (low + high) >>> 1
        const endCode = this.view.getUint16(endCountBase + mid * 2)
        if (codePoint > endCode) {
          low = mid + 1
          continue
        }
        const startCode = this.view.getUint16(startCountBase + mid * 2)
        if (codePoint < startCode) {
          high = mid - 1
          continue
        }
        const idDelta = this.view.getInt16(idDeltaBase + mid * 2)
        const idRangePos = idRangeOffsetBase + mid * 2
        const idRangeOffset = this.view.getUint16(idRangePos)
        if (idRangeOffset === 0) {
          return (codePoint + idDelta) & 0xffff
        }
        const glyphIndexOffset = idRangePos + idRangeOffset + (codePoint - startCode) * 2
        if (glyphIndexOffset + 2 > this.byteLength) return 0
        const rawGid = this.view.getUint16(glyphIndexOffset)
        return rawGid === 0 ? 0 : (rawGid + idDelta) & 0xffff
      }
    }
    return 0
  }

  private getAdvanceWidthByGlyphId(glyphId: number): number {
    const metricIndex = glyphId < this.numberOfHMetrics ? glyphId : this.numberOfHMetrics - 1
    return this.view.getUint16(this.hmtxOffset + metricIndex * 4)
  }

  getGlyphForCodePoint(codePoint: number): ParsedGlyph {
    const cached = this.glyphCache.get(codePoint)
    if (cached) {
      this.glyphCache.delete(codePoint)
      this.glyphCache.set(codePoint, cached)
      return cached
    }

    const glyphId = this.lookupGlyphId(codePoint)
    const advanceWidth = this.getAdvanceWidthByGlyphId(glyphId)
    const builder = new ContourBuilder()
    if (glyphId !== 0) {
      decodeGlyphContoursInto(this.glyfContext, glyphId, builder)
    }

    const parsed: ParsedGlyph = {
      advanceWidth,
      ops: new Uint8Array(builder.ops),
      coords: new Float32Array(builder.coords),
    }

    if (this.glyphCache.size >= MAX_GLYPH_CACHE_ENTRIES) {
      const oldestCodePoint = this.glyphCache.keys().next().value
      if (oldestCodePoint !== undefined) {
        this.glyphCache.delete(oldestCodePoint)
      }
    }
    this.glyphCache.set(codePoint, parsed)
    return parsed
  }

  measureTextWidth(text: string, fontSizePx: number, letterSpacingPx: number = 0): number {
    if (!text) return 0
    const scale = fontSizePx / this.unitsPerEm
    let total = 0
    let glyphCount = 0
    for (let index = 0; index < text.length; ) {
      const cp = text.codePointAt(index)
      if (cp === undefined) break
      index += cp > 0xffff ? 2 : 1
      total += this.getGlyphForCodePoint(cp).advanceWidth * scale
      glyphCount += 1
    }
    if (glyphCount > 1 && letterSpacingPx !== 0) {
      total += (glyphCount - 1) * letterSpacingPx
    }
    return total
  }

  wrapTextLines(
    text: string,
    fontSizePx: number,
    maxWidthPx: number,
    maxLines: number,
    letterSpacingPx: number = 0
  ): string[] {
    if (!text || maxLines <= 0) return []
    const lines: string[] = []
    const chars = Array.from(text)
    const ellipsis = "…"
    const ellipsisWidth = this.measureTextWidth(ellipsis, fontSizePx, letterSpacingPx)

    let cursor = 0
    while (cursor < chars.length && lines.length < maxLines) {
      while (cursor < chars.length && chars[cursor] === " ") cursor += 1
      if (cursor >= chars.length) break

      const isLastLine = lines.length === maxLines - 1
      let lineWidth = 0
      let end = cursor
      let lastSpaceBreak = -1

      while (end < chars.length) {
        const ch = chars[end]
        const cp = ch.codePointAt(0) ?? 0x20
        const charWidth =
          (this.getGlyphForCodePoint(cp).advanceWidth * fontSizePx) / this.unitsPerEm +
          (end > cursor ? letterSpacingPx : 0)
        const limit = isLastLine && end + 1 < chars.length ? maxWidthPx - ellipsisWidth : maxWidthPx

        if (end > cursor && lineWidth + charWidth > limit) {
          break
        }
        lineWidth += charWidth
        if (ch === " ") lastSpaceBreak = end
        end += 1
      }

      if (end >= chars.length) {
        lines.push(chars.slice(cursor).join("").trimEnd())
        break
      }

      if (isLastLine) {
        lines.push(`${chars.slice(cursor, end).join("").trimEnd()}${ellipsis}`)
        break
      }

      if (lastSpaceBreak > cursor && end - lastSpaceBreak <= 14) {
        lines.push(chars.slice(cursor, lastSpaceBreak).join("").trimEnd())
        cursor = lastSpaceBreak + 1
      } else {
        lines.push(chars.slice(cursor, end).join("").trimEnd())
        cursor = end
      }
    }

    return lines
  }

  renderTextToSvgPathD(
    text: string,
    originX: number,
    baselineY: number,
    fontSizePx: number,
    letterSpacingPx: number = 0
  ): string {
    if (!text) return ""
    const scale = fontSizePx / this.unitsPerEm
    const segments: string[] = []
    let penX = originX

    for (let index = 0; index < text.length; ) {
      const cp = text.codePointAt(index)
      if (cp === undefined) break
      index += cp > 0xffff ? 2 : 1

      const glyph = this.getGlyphForCodePoint(cp)
      const { ops, coords } = glyph
      let cIdx = 0

      for (let opIdx = 0; opIdx < ops.length; opIdx += 1) {
        const op = ops[opIdx]
        if (op === OP_MOVE) {
          const x = (penX + coords[cIdx] * scale).toFixed(1)
          const y = (baselineY - coords[cIdx + 1] * scale).toFixed(1)
          segments.push(`M${x} ${y}`)
          cIdx += 2
        } else if (op === OP_LINE) {
          const x = (penX + coords[cIdx] * scale).toFixed(1)
          const y = (baselineY - coords[cIdx + 1] * scale).toFixed(1)
          segments.push(`L${x} ${y}`)
          cIdx += 2
        } else if (op === OP_QUAD) {
          const cx = (penX + coords[cIdx] * scale).toFixed(1)
          const cy = (baselineY - coords[cIdx + 1] * scale).toFixed(1)
          const x = (penX + coords[cIdx + 2] * scale).toFixed(1)
          const y = (baselineY - coords[cIdx + 3] * scale).toFixed(1)
          segments.push(`Q${cx} ${cy} ${x} ${y}`)
          cIdx += 4
        } else if (op === OP_CLOSE) {
          segments.push("Z")
        }
      }

      penX += glyph.advanceWidth * scale + letterSpacingPx
    }

    return segments.join("")
  }
}
