// 참조 구현: opentypejs/opentype.js (MIT, Copyright (c) 2020 Frederik De Bleser, src/tables/glyf.mjs)
// 워드(DataView Uint16/Uint32)·비트마스크 기반 TrueType glyf 단순/복합 윤곽선 디코더

// TrueType simple glyph point bit flags
const GLYF_ON_CURVE = 0x01
const GLYF_X_SHORT = 0x02
const GLYF_Y_SHORT = 0x04
const GLYF_REPEAT = 0x08
const GLYF_X_SAME_OR_POS = 0x10
const GLYF_Y_SAME_OR_POS = 0x20

// TrueType composite glyph component bit flags
const COMP_ARGS_WORDS = 0x0001
const COMP_ARGS_XY = 0x0002
const COMP_SCALE = 0x0008
const COMP_MORE = 0x0020
const COMP_XY_SCALE = 0x0040
const COMP_2X2 = 0x0080

// Compact path opcodes (SoA typed arrays — zero per-point heap allocation)
export const OP_MOVE = 1
export const OP_LINE = 2
export const OP_QUAD = 3
export const OP_CLOSE = 4

const MAX_GLYF_CONTOURS = 256
const MAX_GLYF_POINTS = 4096
const MAX_COMPOSITE_DEPTH = 8

export type GlyfTableContext = {
  view: DataView
  numGlyphs: number
  indexToLocFormat: number
  locaOffset: number
  locaLength: number
  glyfOffset: number
  glyfLength: number
}

export class ContourBuilder {
  ops: number[] = []
  coords: number[] = []

  moveTo(x: number, y: number): void {
    this.ops.push(OP_MOVE)
    this.coords.push(x, y)
  }

  lineTo(x: number, y: number): void {
    this.ops.push(OP_LINE)
    this.coords.push(x, y)
  }

  quadTo(cx: number, cy: number, x: number, y: number): void {
    this.ops.push(OP_QUAD)
    this.coords.push(cx, cy, x, y)
  }

  close(): void {
    this.ops.push(OP_CLOSE)
  }
}

const getGlyphDataBounds = (
  ctx: GlyfTableContext,
  glyphId: number
): { start: number; end: number } | null => {
  if (glyphId < 0 || glyphId >= ctx.numGlyphs) return null
  let startRel: number
  let endRel: number
  if (ctx.indexToLocFormat === 1) {
    const pos = (glyphId + 1) * 4
    if (pos + 4 > ctx.locaLength) return null
    startRel = ctx.view.getUint32(ctx.locaOffset + glyphId * 4)
    endRel = ctx.view.getUint32(ctx.locaOffset + pos)
  } else {
    const pos = (glyphId + 1) * 2
    if (pos + 2 > ctx.locaLength) return null
    startRel = ctx.view.getUint16(ctx.locaOffset + glyphId * 2) << 1
    endRel = ctx.view.getUint16(ctx.locaOffset + pos) << 1
  }
  if (endRel <= startRel || endRel > ctx.glyfLength) return null
  return { start: ctx.glyfOffset + startRel, end: ctx.glyfOffset + endRel }
}

const emitQuadraticContour = (
  builder: ContourBuilder,
  px: Float32Array,
  py: Float32Array,
  flags: Uint8Array,
  start: number,
  count: number
): void => {
  const firstOn = (flags[start] & GLYF_ON_CURVE) !== 0
  const lastIdx = start + count - 1
  const lastOn = (flags[lastIdx] & GLYF_ON_CURVE) !== 0

  let startX: number
  let startY: number
  let indexOffset = 0

  if (firstOn) {
    startX = px[start]
    startY = py[start]
    indexOffset = 1
  } else if (lastOn) {
    startX = px[lastIdx]
    startY = py[lastIdx]
    indexOffset = 0
  } else {
    startX = (px[lastIdx] + px[start]) * 0.5
    startY = (py[lastIdx] + py[start]) * 0.5
    indexOffset = 0
  }

  builder.moveTo(startX, startY)

  let i = indexOffset
  while (i < count) {
    const currIdx = start + i
    const currOn = (flags[currIdx] & GLYF_ON_CURVE) !== 0
    if (currOn) {
      builder.lineTo(px[currIdx], py[currIdx])
      i += 1
      continue
    }

    const cx = px[currIdx]
    const cy = py[currIdx]
    const nextStep = i + 1
    if (nextStep < count) {
      const nextIdx = start + nextStep
      if ((flags[nextIdx] & GLYF_ON_CURVE) !== 0) {
        builder.quadTo(cx, cy, px[nextIdx], py[nextIdx])
        i += 2
      } else {
        builder.quadTo(cx, cy, (cx + px[nextIdx]) * 0.5, (cy + py[nextIdx]) * 0.5)
        i += 1
      }
    } else {
      builder.quadTo(cx, cy, startX, startY)
      i += 1
    }
  }

  builder.close()
}

const decodeSimpleGlyph = (
  view: DataView,
  start: number,
  end: number,
  numberOfContours: number,
  builder: ContourBuilder,
  m00: number,
  m01: number,
  m10: number,
  m11: number,
  dx: number,
  dy: number
): void => {
  const endPtsBase = start + 10
  const instrLenPos = endPtsBase + numberOfContours * 2
  if (instrLenPos + 2 > end) return

  const endPtsOfContours = new Uint16Array(numberOfContours)
  for (let i = 0; i < numberOfContours; i += 1) {
    endPtsOfContours[i] = view.getUint16(endPtsBase + i * 2)
  }
  const numPoints = endPtsOfContours[numberOfContours - 1] + 1
  if (numPoints === 0 || numPoints > MAX_GLYF_POINTS) return

  const instructionLength = view.getUint16(instrLenPos)
  let cursor = instrLenPos + 2 + instructionLength
  if (cursor > end) return

  const flags = new Uint8Array(numPoints)
  for (let i = 0; i < numPoints; i += 1) {
    if (cursor >= end) return
    const flag = view.getUint8(cursor)
    cursor += 1
    flags[i] = flag
    if ((flag & GLYF_REPEAT) !== 0) {
      if (cursor >= end) return
      const repeatCount = view.getUint8(cursor)
      cursor += 1
      for (let r = 0; r < repeatCount && i + 1 < numPoints; r += 1) {
        i += 1
        flags[i] = flag
      }
    }
  }

  const rawX = new Int16Array(numPoints)
  let x = 0
  for (let i = 0; i < numPoints; i += 1) {
    const flag = flags[i]
    if ((flag & GLYF_X_SHORT) !== 0) {
      if (cursor >= end) return
      const delta = view.getUint8(cursor)
      cursor += 1
      x += (flag & GLYF_X_SAME_OR_POS) !== 0 ? delta : -delta
    } else if ((flag & GLYF_X_SAME_OR_POS) === 0) {
      if (cursor + 2 > end) return
      x += view.getInt16(cursor)
      cursor += 2
    }
    rawX[i] = x
  }

  const rawY = new Int16Array(numPoints)
  let y = 0
  for (let i = 0; i < numPoints; i += 1) {
    const flag = flags[i]
    if ((flag & GLYF_Y_SHORT) !== 0) {
      if (cursor >= end) return
      const delta = view.getUint8(cursor)
      cursor += 1
      y += (flag & GLYF_Y_SAME_OR_POS) !== 0 ? delta : -delta
    } else if ((flag & GLYF_Y_SAME_OR_POS) === 0) {
      if (cursor + 2 > end) return
      y += view.getInt16(cursor)
      cursor += 2
    }
    rawY[i] = y
  }

  const px = new Float32Array(numPoints)
  const py = new Float32Array(numPoints)
  for (let i = 0; i < numPoints; i += 1) {
    const rx = rawX[i]
    const ry = rawY[i]
    px[i] = m00 * rx + m10 * ry + dx
    py[i] = m01 * rx + m11 * ry + dy
  }

  let contourStart = 0
  for (let c = 0; c < numberOfContours; c += 1) {
    const contourEnd = endPtsOfContours[c]
    if (contourEnd >= numPoints || contourEnd < contourStart) break
    const count = contourEnd - contourStart + 1
    if (count >= 2) {
      emitQuadraticContour(builder, px, py, flags, contourStart, count)
    }
    contourStart = contourEnd + 1
  }
}

export const decodeGlyphContoursInto = (
  ctx: GlyfTableContext,
  glyphId: number,
  builder: ContourBuilder,
  m00: number = 1,
  m01: number = 0,
  m10: number = 0,
  m11: number = 1,
  dx: number = 0,
  dy: number = 0,
  depth: number = 0
): void => {
  if (depth > MAX_COMPOSITE_DEPTH) return
  const bounds = getGlyphDataBounds(ctx, glyphId)
  if (!bounds || bounds.end - bounds.start < 10) return

  const numberOfContours = ctx.view.getInt16(bounds.start)
  if (numberOfContours === 0) return

  if (numberOfContours > 0) {
    if (numberOfContours > MAX_GLYF_CONTOURS) return
    decodeSimpleGlyph(ctx.view, bounds.start, bounds.end, numberOfContours, builder, m00, m01, m10, m11, dx, dy)
    return
  }

  let cursor = bounds.start + 10
  let flags = COMP_MORE
  while ((flags & COMP_MORE) !== 0 && cursor + 4 <= bounds.end) {
    flags = ctx.view.getUint16(cursor)
    const componentGlyphId = ctx.view.getUint16(cursor + 2)
    cursor += 4

    let arg1 = 0
    let arg2 = 0
    if ((flags & COMP_ARGS_WORDS) !== 0) {
      if (cursor + 4 > bounds.end) return
      arg1 = (flags & COMP_ARGS_XY) !== 0 ? ctx.view.getInt16(cursor) : ctx.view.getUint16(cursor)
      arg2 = (flags & COMP_ARGS_XY) !== 0 ? ctx.view.getInt16(cursor + 2) : ctx.view.getUint16(cursor + 2)
      cursor += 4
    } else {
      if (cursor + 2 > bounds.end) return
      arg1 = (flags & COMP_ARGS_XY) !== 0 ? ctx.view.getInt8(cursor) : ctx.view.getUint8(cursor)
      arg2 = (flags & COMP_ARGS_XY) !== 0 ? ctx.view.getInt8(cursor + 1) : ctx.view.getUint8(cursor + 1)
      cursor += 2
    }

    let c00 = 1
    let c01 = 0
    let c10 = 0
    let c11 = 1
    if ((flags & COMP_SCALE) !== 0) {
      if (cursor + 2 > bounds.end) return
      c00 = ctx.view.getInt16(cursor) / 16384
      c11 = c00
      cursor += 2
    } else if ((flags & COMP_XY_SCALE) !== 0) {
      if (cursor + 4 > bounds.end) return
      c00 = ctx.view.getInt16(cursor) / 16384
      c11 = ctx.view.getInt16(cursor + 2) / 16384
      cursor += 4
    } else if ((flags & COMP_2X2) !== 0) {
      if (cursor + 8 > bounds.end) return
      c00 = ctx.view.getInt16(cursor) / 16384
      c01 = ctx.view.getInt16(cursor + 2) / 16384
      c10 = ctx.view.getInt16(cursor + 4) / 16384
      c11 = ctx.view.getInt16(cursor + 6) / 16384
      cursor += 8
    }

    const tx = (flags & COMP_ARGS_XY) !== 0 ? arg1 : 0
    const ty = (flags & COMP_ARGS_XY) !== 0 ? arg2 : 0
    decodeGlyphContoursInto(
      ctx,
      componentGlyphId,
      builder,
      m00 * c00 + m10 * c01,
      m01 * c00 + m11 * c01,
      m00 * c10 + m10 * c11,
      m01 * c10 + m11 * c11,
      m00 * tx + m10 * ty + dx,
      m01 * tx + m11 * ty + dy,
      depth + 1
    )
  }
}
