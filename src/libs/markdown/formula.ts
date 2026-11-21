type RenderFormulaOptions = {
  displayMode?: boolean
}

const FALLBACK_PREFIX = "aq-formula-fallback"

type KatexModule = typeof import("katex")

let katexPromise: Promise<KatexModule["default"]> | null = null

const loadKatex = () => {
  if (!katexPromise) {
    katexPromise = import("katex").then((module) => module.default)
  }

  return katexPromise
}

export const renderFormulaFallbackHtml = (
  formula: string,
  { displayMode = true }: RenderFormulaOptions = {}
) => {
  const normalized = String(formula || "").trim()
  if (!normalized) return ""

  return displayMode
    ? `<code class="${FALLBACK_PREFIX}">${escapeFormulaHtml(normalized)}</code>`
    : `<span class="${FALLBACK_PREFIX}">${escapeFormulaHtml(normalized)}</span>`
}

const escapeFormulaHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const MAX_FORMULA_CACHE_ENTRIES = 256
const formulaHtmlCache = new Map<string, string>()

const getCachedFormulaHtml = (key: string): string | undefined => {
  const cached = formulaHtmlCache.get(key)
  if (cached === undefined) return undefined
  formulaHtmlCache.delete(key)
  formulaHtmlCache.set(key, cached)
  return cached
}

const setCachedFormulaHtml = (key: string, html: string) => {
  if (formulaHtmlCache.has(key)) {
    formulaHtmlCache.delete(key)
  } else if (formulaHtmlCache.size >= MAX_FORMULA_CACHE_ENTRIES) {
    const oldestKey = formulaHtmlCache.keys().next().value
    if (oldestKey !== undefined) {
      formulaHtmlCache.delete(oldestKey)
    }
  }
  formulaHtmlCache.set(key, html)
}

export const renderFormulaToHtml = async (
  formula: string,
  { displayMode = true }: RenderFormulaOptions = {}
) => {
  const normalized = String(formula || "").trim()
  if (!normalized) return ""

  const cacheKey = `${displayMode ? "1" : "0"}:${normalized}`
  const cached = getCachedFormulaHtml(cacheKey)
  if (cached !== undefined) return cached

  try {
    const katex = await loadKatex()
    const rendered = katex.renderToString(normalized, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      output: "html",
      trust: false,
    })
    setCachedFormulaHtml(cacheKey, rendered)
    return rendered
  } catch {
    return renderFormulaFallbackHtml(normalized, { displayMode })
  }
}
