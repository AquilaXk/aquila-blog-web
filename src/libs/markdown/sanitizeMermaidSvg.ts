import DOMPurify from "dompurify"

type DomPurifyLike = {
  isSupported?: boolean
  sanitize?: (dirty: string, cfg?: Record<string, unknown>) => string
}

const FORBIDDEN_MERMAID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
  "form",
  "input",
  "button",
  "textarea",
  "select",
]

const NON_BROWSER_TEST_DANGEROUS_SVG_PATTERN =
  /<\/?(?:script|iframe|object|embed|applet|base|meta|link|form|input|button|textarea|select)\b|(?:[\s/]|^)on[a-z0-9_-]+\s*=|(?:javascript|vbscript|data)\s*:|&#/i

const resolveDomPurifyInstance = (): DomPurifyLike | null => {
  if (typeof window === "undefined") return null
  const candidate = DOMPurify as unknown as DomPurifyLike & ((win: Window) => DomPurifyLike)
  if (candidate.isSupported && typeof candidate.sanitize === "function") {
    return candidate
  }
  if (typeof candidate === "function") {
    try {
      const initialized = candidate(window)
      if (initialized?.isSupported && typeof initialized.sanitize === "function") {
        return initialized
      }
    } catch {
      return null
    }
  }
  return null
}

export const sanitizeMermaidSvg = (rawSvg: string): string => {
  if (!rawSvg) return ""

  const hasBrowserDomParser =
    typeof window !== "undefined" && typeof window.DOMParser === "function"
  if (hasBrowserDomParser) {
    const purifier = resolveDomPurifyInstance()
    if (!purifier?.sanitize) {
      return ""
    }
    return purifier.sanitize(rawSvg, {
      USE_PROFILES: { svg: true, svgFilters: true, html: true },
      ADD_TAGS: ["foreignObject"],
      HTML_INTEGRATION_POINTS: { foreignobject: true },
      FORBID_TAGS: FORBIDDEN_MERMAID_TAGS,
    })
  }

  if (process.env.NODE_ENV === "production") {
    return ""
  }

  // Non-browser Node unit tests use lightweight mock DOM stubs without DOMParser; fail closed on any active payload.
  if (NON_BROWSER_TEST_DANGEROUS_SVG_PATTERN.test(rawSvg)) {
    return ""
  }
  return rawSvg
}
