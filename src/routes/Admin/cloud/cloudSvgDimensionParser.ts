export const MAX_SVG_MARKUP_BYTES = 256 * 1024
const MAX_SVG_DIMENSION_COORD = 1_000_000

export type CloudAssetDimensions = {
  width: number
  height: number
}

const isAsciiWhitespace = (code: number): boolean =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c

const isAttrNameStop = (code: number): boolean =>
  isAsciiWhitespace(code) || code === 0x3d || code === 0x3e || code === 0x2f

const isUnquotedValStop = (code: number): boolean =>
  isAsciiWhitespace(code) || code === 0x3e || code === 0x2f

const parseSvgPixelLength = (raw: string | null): number | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || !/^\+?(?:\d+\.?\d*|\.\d+)(?:px)?$/i.test(trimmed)) return null
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SVG_DIMENSION_COORD) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

const parseSvgViewBoxDimensions = (raw: string | null): CloudAssetDimensions | null => {
  if (!raw) return null
  const tokens = raw.trim().split(/[\s,]+/)
  if (tokens.length !== 4) return null
  const [minX, minY, vbWidth, vbHeight] = tokens.map(Number)
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  if (!Number.isFinite(vbWidth) || vbWidth <= 0 || vbWidth > MAX_SVG_DIMENSION_COORD) return null
  if (!Number.isFinite(vbHeight) || vbHeight <= 0 || vbHeight > MAX_SVG_DIMENSION_COORD) return null
  const width = Math.round(vbWidth)
  const height = Math.round(vbHeight)
  return width > 0 && height > 0 ? { width, height } : null
}

const locateSvgStartTagBodyOffset = (svgText: string): number => {
  const len = svgText.length
  let i = svgText.charCodeAt(0) === 0xfeff ? 1 : 0
  while (i < len) {
    const lt = svgText.indexOf("<", i)
    if (lt < 0 || lt + 3 >= len) return -1
    if (svgText.startsWith("<!--", lt)) {
      const endComment = svgText.indexOf("-->", lt + 4)
      if (endComment < 0) return -1
      i = endComment + 3
      continue
    }
    if (svgText.startsWith("<?", lt)) {
      const endPi = svgText.indexOf("?>", lt + 2)
      if (endPi < 0) return -1
      i = endPi + 2
      continue
    }
    if (svgText.slice(lt, lt + 9).toLowerCase() === "<!doctype") {
      let cursor = lt + 9
      let bracketDepth = 0
      while (cursor < len) {
        const ch = svgText.charCodeAt(cursor)
        if (ch === 0x5b) bracketDepth += 1
        else if (ch === 0x5d && bracketDepth > 0) bracketDepth -= 1
        else if (ch === 0x3e && bracketDepth === 0) break
        cursor += 1
      }
      if (cursor >= len) return -1
      i = cursor + 1
      continue
    }
    const c1 = svgText.charCodeAt(lt + 1) | 0x20
    const c2 = svgText.charCodeAt(lt + 2) | 0x20
    const c3 = svgText.charCodeAt(lt + 3) | 0x20
    const nextCode = lt + 4 < len ? svgText.charCodeAt(lt + 4) : 0x3e
    if (c1 === 0x73 && c2 === 0x76 && c3 === 0x67 && isUnquotedValStop(nextCode)) {
      return lt + 4
    }
    i = lt + 1
  }
  return -1
}

export const parseSvgDimensionsFromMarkup = (svgText: string): CloudAssetDimensions | null => {
  if (!svgText || svgText.length > MAX_SVG_MARKUP_BYTES || svgText.indexOf("\0") !== -1) {
    return null
  }
  let cursor = locateSvgStartTagBodyOffset(svgText)
  if (cursor < 0) return null

  const len = svgText.length
  let widthAttr: string | null = null
  let heightAttr: string | null = null
  let viewBoxAttr: string | null = null

  while (cursor < len) {
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len) return null
    const ch = svgText.charCodeAt(cursor)
    if (ch === 0x3e) break
    if (ch === 0x2f) {
      cursor += 1
      continue
    }
    const nameStart = cursor
    while (cursor < len && !isAttrNameStop(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor === nameStart) {
      cursor += 1
      continue
    }
    const attrName = svgText.slice(nameStart, cursor).toLowerCase()
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len || svgText.charCodeAt(cursor) !== 0x3d) continue
    cursor += 1
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len) return null

    const quote = svgText.charCodeAt(cursor)
    let attrValue = ""
    if (quote === 0x22 || quote === 0x27) {
      const closeIdx = svgText.indexOf(quote === 0x22 ? '"' : "'", cursor + 1)
      if (closeIdx < 0) return null
      attrValue = svgText.slice(cursor + 1, closeIdx)
      cursor = closeIdx + 1
    } else {
      const valStart = cursor
      while (cursor < len && !isUnquotedValStop(svgText.charCodeAt(cursor))) cursor += 1
      attrValue = svgText.slice(valStart, cursor)
    }

    if (attrName === "width") widthAttr = attrValue
    else if (attrName === "height") heightAttr = attrValue
    else if (attrName === "viewbox") viewBoxAttr = attrValue
  }

  const parsedWidth = parseSvgPixelLength(widthAttr)
  const parsedHeight = parseSvgPixelLength(heightAttr)
  if (parsedWidth !== null && parsedHeight !== null) {
    return { width: parsedWidth, height: parsedHeight }
  }
  return parseSvgViewBoxDimensions(viewBoxAttr)
}
