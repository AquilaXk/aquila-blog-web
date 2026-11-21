// 참조 구현: satnaing/astro-paper (MIT, Copyright (c) 2023 Sat Naing) — 동적 포스트 OG 이미지 경로 및 메타 정규화
import { isDefaultCategoryValue, splitCategoryDisplay } from "src/libs/utils/category"

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const MAX_OG_RAW_QUERY_LENGTH = 2048
export const MAX_OG_TITLE_CODE_POINTS = 120
export const MAX_OG_CATEGORY_CODE_POINTS = 32
export const MAX_OG_TAG_CODE_POINTS = 24
export const MAX_OG_TAG_COUNT = 3

export type OgCardQueryParams = {
  title: string
  category: string
  tags: string[]
}

const isControlOrSpaceCodePoint = (cp: number): number => {
  if (cp <= 0x20 || cp === 0x7f) return cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d ? 1 : 2
  if (cp >= 0x80 && cp <= 0x9f) return 2
  return 0
}

export const sanitizeOgTextParam = (
  raw: unknown,
  maxCodePoints: number
): string => {
  if (typeof raw !== "string" || maxCodePoints <= 0) return ""
  const normalized = raw.normalize("NFC")
  if (!normalized) return ""

  const codePoints: number[] = []
  let prevWasSpace = true
  let count = 0

  for (let index = 0; index < normalized.length; ) {
    const cp = normalized.codePointAt(index)
    if (cp === undefined) break
    index += cp > 0xffff ? 2 : 1

    const kind = isControlOrSpaceCodePoint(cp)
    if (kind === 2) continue
    if (kind === 1) {
      if (!prevWasSpace && count < maxCodePoints) {
        codePoints.push(0x20)
        prevWasSpace = true
        count += 1
      }
      continue
    }

    if (count >= maxCodePoints) break
    codePoints.push(cp)
    prevWasSpace = false
    count += 1
  }

  if (codePoints.length > 0 && codePoints[codePoints.length - 1] === 0x20) {
    codePoints.pop()
  }

  return codePoints.length > 0 ? String.fromCodePoint(...codePoints) : ""
}

const isPlaceholderCategoryLabel = (value: string): boolean => {
  const lower = value.trim().toLowerCase()
  return (
    !lower ||
    isDefaultCategoryValue(value) ||
    lower === "미분류" ||
    lower === "uncategorized"
  )
}

const normalizeCategoryLabel = (rawCategory: string | undefined): string => {
  const trimmed = (rawCategory ?? "").trim()
  if (isPlaceholderCategoryLabel(trimmed)) return ""
  const label = splitCategoryDisplay(trimmed).label.trim()
  if (isPlaceholderCategoryLabel(label)) return ""
  return sanitizeOgTextParam(label, MAX_OG_CATEGORY_CODE_POINTS)
}

const normalizeTagList = (rawTags: unknown): string[] => {
  const candidates: string[] = []
  if (typeof rawTags === "string") {
    const parts = rawTags.split(",")
    for (let i = 0; i < parts.length; i += 1) {
      candidates.push(parts[i] ?? "")
    }
  } else if (Array.isArray(rawTags)) {
    for (let i = 0; i < rawTags.length; i += 1) {
      const item = rawTags[i]
      if (typeof item !== "string") continue
      const parts = item.split(",")
      for (let j = 0; j < parts.length; j += 1) {
        candidates.push(parts[j] ?? "")
      }
    }
  }

  const seen = new Set<string>()
  const result: string[] = []
  for (let i = 0; i < candidates.length && result.length < MAX_OG_TAG_COUNT; i += 1) {
    const cleaned = sanitizeOgTextParam(candidates[i], MAX_OG_TAG_CODE_POINTS).replace(/^#+/, "")
    if (!cleaned) continue
    const dedupeKey = cleaned.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(cleaned)
  }
  return result
}

const pickFirstQueryString = (value: string | string[] | undefined): string => {
  if (typeof value === "string") return value
  if (Array.isArray(value) && typeof value[0] === "string") return value[0]
  return ""
}

export const parseOgQueryParams = (
  query: Record<string, string | string[] | undefined>,
  fallbackSiteTitle: string = "AquilaLog"
): OgCardQueryParams => {
  const title =
    sanitizeOgTextParam(pickFirstQueryString(query.title), MAX_OG_TITLE_CODE_POINTS) ||
    sanitizeOgTextParam(fallbackSiteTitle, MAX_OG_TITLE_CODE_POINTS) ||
    "AquilaLog"
  const category = normalizeCategoryLabel(pickFirstQueryString(query.category))
  const tags = normalizeTagList(query.tags)
  return { title, category, tags }
}

export const buildPostOgImagePath = ({
  title,
  category,
  tags,
}: {
  title?: string | null
  category?: readonly string[] | string | null
  tags?: readonly string[] | null
}): string => {
  const cleanTitle = sanitizeOgTextParam(title ?? "", MAX_OG_TITLE_CODE_POINTS)
  const rawPrimaryCategory = Array.isArray(category)
    ? category[0]
    : typeof category === "string"
      ? category
      : undefined
  const cleanCategory = normalizeCategoryLabel(rawPrimaryCategory)
  const cleanTags = normalizeTagList(tags)

  const params = new URLSearchParams()
  if (cleanTitle) params.set("title", cleanTitle)
  if (cleanCategory) params.set("category", cleanCategory)
  if (cleanTags.length > 0) params.set("tags", cleanTags.join(","))

  const serialized = params.toString()
  return serialized ? `/api/og?${serialized}` : "/api/og"
}
