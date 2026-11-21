// 참조 구현: satnaing/astro-paper (MIT, Copyright (c) 2023 Sat Naing) & adityatelange/hugo-PaperMod (MIT)
// 1200x630 기술블로그 동적 OpenGraph PNG 렌더러 (시스템 폰트 무의존 TrueType <path> + sharp 합성 + O(1) LRU 캐시)
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { CONFIG } from "site.config"
import { colors } from "src/styles/colors"
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  type OgCardQueryParams,
} from "./ogUrl"
import { TrueTypeOutlineFont } from "./ttfOutlineRenderer"

const MAX_PNG_CACHE_ENTRIES = 64
const FONT_REL_PATH = "public/fonts/IBMPlexSansKR-SemiBold.ttf"
const MASCOT_REL_PATH = "public/brand-mascot.d43c0dc3.png"
const MASCOT_SIZE = 44

let cachedFont: TrueTypeOutlineFont | null = null
let cachedMascotPngPromise: Promise<Buffer | null> | null = null
const pngLruCache = new Map<string, Buffer>()
const inflightPngRenders = new Map<string, Promise<Buffer>>()

const resolvePublicAssetPath = (relativeAssetPath: string): string => {
  const cwdCandidate = path.join(process.cwd(), relativeAssetPath)
  if (fs.existsSync(cwdCandidate)) return cwdCandidate
  const fallbackCandidate = path.resolve(__dirname, "../../../../", relativeAssetPath)
  return fallbackCandidate
}

const getOgOutlineFont = (): TrueTypeOutlineFont => {
  if (cachedFont) return cachedFont
  const fontPath = resolvePublicAssetPath(FONT_REL_PATH)
  const rawBytes = fs.readFileSync(fontPath)
  cachedFont = new TrueTypeOutlineFont(rawBytes)
  return cachedFont
}

const getRoundedMascotBuffer = (): Promise<Buffer | null> => {
  if (cachedMascotPngPromise) return cachedMascotPngPromise
  cachedMascotPngPromise = (async () => {
    const mascotPath = resolvePublicAssetPath(MASCOT_REL_PATH)
    if (!fs.existsSync(mascotPath)) return null
    const maskSvg = Buffer.from(
      `<svg width="${MASCOT_SIZE}" height="${MASCOT_SIZE}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${MASCOT_SIZE}" height="${MASCOT_SIZE}" rx="12" ry="12" fill="${colors.light.gray1}"/></svg>`
    )
    return sharp(mascotPath)
      .resize(MASCOT_SIZE, MASCOT_SIZE, { fit: "cover" })
      .composite([{ input: maskSvg, blend: "dest-in" }])
      .png()
      .toBuffer()
  })().catch(() => null)
  return cachedMascotPngPromise
}

const resolveSiteDomainLabel = (): string => {
  try {
    return new URL(CONFIG.link || "https://blog.aquilaxk.site").hostname
  } catch {
    return "blog.aquilaxk.site"
  }
}

const buildGridPatternMarkup = (): string => {
  const lines: string[] = []
  for (let x = 60; x < OG_IMAGE_WIDTH; x += 60) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${OG_IMAGE_HEIGHT}"/>`)
  }
  for (let y = 60; y < OG_IMAGE_HEIGHT; y += 60) {
    lines.push(`<line x1="0" y1="${y}" x2="${OG_IMAGE_WIDTH}" y2="${y}"/>`)
  }
  return lines.join("")
}

const STATIC_GRID_LINES = buildGridPatternMarkup()

export const buildOgCardSvg = (
  params: OgCardQueryParams,
  options: { hasMascotBadge?: boolean; font?: TrueTypeOutlineFont } = {}
): string => {
  const font = options.font ?? getOgOutlineFont()
  const hasMascot = options.hasMascotBadge ?? false
  const palette = colors.light

  const siteTitle = (CONFIG.blog.title || "AquilaLog").trim()
  const siteDomain = resolveSiteDomainLabel()

  const cardLeft = 56
  const cardTop = 48
  const cardWidth = 1088
  const cardHeight = 534
  const contentLeft = 108
  const contentRight = 1092
  const maxTextWidth = contentRight - contentLeft

  const kickerLabel = params.category || "TECH POST"
  const kickerFontSize = 20
  const kickerTextWidth = font.measureTextWidth(kickerLabel, kickerFontSize, 0.2)
  const kickerPadX = 18
  const kickerWidth = Math.min(maxTextWidth, Math.ceil(kickerTextWidth + kickerPadX * 2))
  const kickerPath = font.renderTextToSvgPathD(
    kickerLabel,
    contentLeft + kickerPadX,
    130,
    kickerFontSize,
    0.2
  )

  const singlePassWidth = font.measureTextWidth(params.title, 54, -0.6)
  const titleFontSize = singlePassWidth <= maxTextWidth * 1.85 ? 54 : 46
  const titleLineHeight = titleFontSize === 54 ? 72 : 62
  const titleLines = font.wrapTextLines(params.title, titleFontSize, maxTextWidth, 3, -0.6)
  const firstTitleBaselineY = titleLines.length === 1 ? 256 : titleLines.length === 2 ? 236 : 218

  const titlePaths: string[] = []
  for (let i = 0; i < titleLines.length; i += 1) {
    const lineD = font.renderTextToSvgPathD(
      titleLines[i] ?? "",
      contentLeft,
      firstTitleBaselineY + i * titleLineHeight,
      titleFontSize,
      -0.6
    )
    if (lineD) {
      titlePaths.push(`<path d="${lineD}" fill="${palette.gray12}"/>`)
    }
  }

  let tagsMarkup = ""
  if (params.tags.length > 0) {
    const tagText = params.tags.map((tag) => `#${tag}`).join("   ")
    const clippedTagLine = font.wrapTextLines(tagText, 23, maxTextWidth, 1, 0)[0] ?? ""
    const tagPathD = font.renderTextToSvgPathD(clippedTagLine, contentLeft, 444, 23, 0)
    if (tagPathD) {
      tagsMarkup = `<path d="${tagPathD}" fill="${palette.gray10}"/>`
    }
  }

  const brandNameX = hasMascot ? contentLeft + MASCOT_SIZE + 14 : contentLeft
  const brandNamePath = font.renderTextToSvgPathD(siteTitle, brandNameX, 536, 26, -0.2)
  const domainWidth = font.measureTextWidth(siteDomain, 21, 0)
  const domainPath = font.renderTextToSvgPathD(
    siteDomain,
    Math.max(brandNameX + 220, contentRight - domainWidth),
    535,
    21,
    0
  )

  return [
    `<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs><clipPath id="ogCardClip"><rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="20" ry="20"/></clipPath></defs>`,
    `<rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="${palette.gray3}"/>`,
    `<g stroke="${palette.gray4}" stroke-width="1">${STATIC_GRID_LINES}</g>`,
    `<g clip-path="url(#ogCardClip)">`,
    `<rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" fill="${palette.gray1}"/>`,
    `<rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="8" fill="${palette.accentControl}"/>`,
    `</g>`,
    `<rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="20" ry="20" fill="none" stroke="${palette.gray5}" stroke-width="1.5"/>`,
    `<rect x="${contentLeft}" y="102" width="${kickerWidth}" height="40" rx="20" ry="20" fill="${palette.accentSurfaceSubtle}" stroke="${palette.accentBorder}" stroke-width="1"/>`,
    kickerPath ? `<path d="${kickerPath}" fill="${palette.accentControl}"/>` : "",
    titlePaths.join(""),
    tagsMarkup,
    `<line x1="${contentLeft}" y1="482" x2="${contentRight}" y2="482" stroke="${palette.gray4}" stroke-width="1.5"/>`,
    brandNamePath ? `<path d="${brandNamePath}" fill="${palette.gray12}"/>` : "",
    domainPath ? `<path d="${domainPath}" fill="${palette.gray9}"/>` : "",
    `</svg>`,
  ].join("")
}

const getCacheKey = (params: OgCardQueryParams): string =>
  `${params.title}\0${params.category}\0${params.tags.join(",")}`

export const renderOgCardPngBuffer = async (params: OgCardQueryParams): Promise<Buffer> => {
  const key = getCacheKey(params)
  const hit = pngLruCache.get(key)
  if (hit) {
    pngLruCache.delete(key)
    pngLruCache.set(key, hit)
    return hit
  }

  const inflight = inflightPngRenders.get(key)
  if (inflight) {
    return inflight
  }

  const renderPromise = (async () => {
    const mascotBuffer = await getRoundedMascotBuffer()
    const svgMarkup = buildOgCardSvg(params, { hasMascotBadge: mascotBuffer !== null })

    let pipeline = sharp(Buffer.from(svgMarkup))
    if (mascotBuffer) {
      pipeline = pipeline.composite([{ input: mascotBuffer, left: 108, top: 505 }])
    }
    const pngBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer()

    if (pngLruCache.size >= MAX_PNG_CACHE_ENTRIES) {
      const oldestKey = pngLruCache.keys().next().value
      if (oldestKey !== undefined) {
        pngLruCache.delete(oldestKey)
      }
    }
    pngLruCache.set(key, pngBuffer)
    return pngBuffer
  })()

  inflightPngRenders.set(key, renderPromise)
  try {
    return await renderPromise
  } finally {
    if (inflightPngRenders.get(key) === renderPromise) {
      inflightPngRenders.delete(key)
    }
  }
}
