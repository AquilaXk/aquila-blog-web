import type {
  MermaidComplexityLevel,
  MermaidComplexitySummary,
  MermaidRenderCacheEntry,
  MermaidRuntimeInstance,
  MermaidRuntimePreset,
  MermaidVisualPreset,
} from "src/libs/markdown/mermaidRuntimeTypes"

export const MERMAID_SOURCE_PATTERN =
  /^(%%\{|\s*(?:info|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|c4Context|C4Context|xychart-beta)\b)/
export const MERMAID_FLOWCHART_HEADER_PATTERN = /^\s*(?:flowchart|graph)\b/i
export const MERMAID_RISKY_STYLE_DIRECTIVE_PATTERN = /^\s*(style|linkStyle|classDef)\b/i
export const MERMAID_INIT_DIRECTIVE_PATTERN = /^\s*%%\{\s*(init|initialize)\s*:\s*([\s\S]*?)\}\s*%%(?:\r?\n)?/i
export const MERMAID_RISKY_INIT_KEY_PATTERN = /^(theme|themeVariables|themeCSS|darkMode)$/i

export const DESKTOP_MERMAID_MIN_VIEWPORT_PX = 1201
export const MERMAID_DESKTOP_WIDE_MAX_PX = 980
export const MERMAID_DESKTOP_SAFE_MARGIN_PX = 24
export const MERMAID_EXPAND_THRESHOLD_PX = 80
export const MERMAID_VIEWPORT_ROOT_MARGIN = "360px 0px"
export const MERMAID_RENDER_TIMEOUT_MS = 6000
export const MERMAID_COMPLEX_SCALE_CAP = 0.88

const MERMAID_VISUAL_PRESET: MermaidVisualPreset = "github"
const GITHUB_MERMAID_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
const MERMAID_COMPLEX_EDGE_THRESHOLD = 80
const MERMAID_COMPLEX_NODE_THRESHOLD = 72
const MERMAID_COMPLEX_SOURCE_THRESHOLD = 16000
const MERMAID_CACHE_MAX_ENTRIES = 120
const MERMAID_EDGE_TOKENS = [
  "<-->",
  "-.->",
  "==>",
  "-->",
  "--x",
  "x--",
  "o--",
  "--o",
  "<--",
  "<->",
  "=>",
  "<=",
  "==",
] as const
const MERMAID_EDGE_TOKENS_BY_LENGTH = [...MERMAID_EDGE_TOKENS].sort(
  (left, right) => right.length - left.length
)
const mermaidRenderCache = new Map<string, MermaidRenderCacheEntry>()

const FENCED_MERMAID_BLOCK_PATTERN = /^[`~]{3,}\s*mermaid\b[\t ]*\n([\s\S]*?)\n[`~]{3,}\s*$/i

export const isMermaidSource = (rawCode: string) => {
  const normalized = rawCode.trim()
  if (!normalized) return false

  const fenced =
    normalized.startsWith("```") || normalized.startsWith("~~~")
      ? FENCED_MERMAID_BLOCK_PATTERN.exec(normalized)
      : null
  const body = (fenced?.[1] || normalized).trim()
  if (!body) return false

  let lineStart = 0
  let firstNonEmptyLine = ""
  while (lineStart <= body.length) {
    const lineEnd = body.indexOf("\n", lineStart)
    const candidate = (
      lineEnd === -1 ? body.slice(lineStart) : body.slice(lineStart, lineEnd)
    ).trim()
    if (candidate.length > 0) {
      firstNonEmptyLine = candidate
      break
    }
    if (lineEnd === -1) break
    lineStart = lineEnd + 1
  }
  if (!firstNonEmptyLine) return false

  const firstLine = firstNonEmptyLine.replace(/^\d+\s+/, "")
  return MERMAID_SOURCE_PATTERN.test(firstLine)
}

export const buildMermaidCacheKey = (source: string, themeKey: string, wideLane: boolean) =>
  `${themeKey}:${wideLane ? "wide" : "contained"}:${source}`

export const readMermaidCache = (cacheKey: string) => {
  const cached = mermaidRenderCache.get(cacheKey)
  if (!cached) return null
  mermaidRenderCache.delete(cacheKey)
  mermaidRenderCache.set(cacheKey, cached)
  return cached
}

export const writeMermaidCache = (cacheKey: string, value: MermaidRenderCacheEntry) => {
  if (mermaidRenderCache.has(cacheKey)) {
    mermaidRenderCache.delete(cacheKey)
  }
  mermaidRenderCache.set(cacheKey, value)
  if (mermaidRenderCache.size <= MERMAID_CACHE_MAX_ENTRIES) return
  const oldestKey = mermaidRenderCache.keys().next().value
  if (oldestKey) {
    mermaidRenderCache.delete(oldestKey)
  }
}

export const countMermaidEdgeTokens = (source: string) => {
  let count = 0
  let index = 0

  while (index < source.length) {
    const c = source.codePointAt(index)
    if (c !== 60 && c !== 45 && c !== 61 && c !== 120 && c !== 111) {
      index += 1
      continue
    }
    let matched = false
    for (const token of MERMAID_EDGE_TOKENS_BY_LENGTH) {
      if (!source.startsWith(token, index)) continue
      count += 1
      index += token.length
      matched = true
      break
    }
    if (!matched) {
      index += 1
    }
  }

  return count
}

const resolveMatchedShapeEnd = (
  source: string,
  start: number,
  cursor: number,
  closeCode: number,
  doubleClose: boolean
): number => {
  if (cursor <= start) return -1
  if (!doubleClose) return cursor + 1
  return source.codePointAt(cursor + 1) === closeCode ? cursor + 2 : -1
}

const findMatchingMermaidShapeEnd = (
  source: string,
  openIndex: number,
  closeCode: number,
  doubleClose: boolean
): number => {
  const start = openIndex + (doubleClose ? 2 : 1)
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const code = source.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) return -1
    if (code === closeCode) {
      return resolveMatchedShapeEnd(source, start, cursor, closeCode, doubleClose)
    }
  }
  return -1
}

const countMermaidNodeShapes = (source: string): number => {
  let count = 0
  let index = 0
  while (index < source.length) {
    const code = source.codePointAt(index) ?? 0
    let shapeEnd = -1
    if (code === 91) {
      shapeEnd = findMatchingMermaidShapeEnd(source, index, 93, false)
    } else if (code === 123) {
      shapeEnd = findMatchingMermaidShapeEnd(source, index, 125, false)
    } else if (code === 40) {
      const isDoubleParen = source.codePointAt(index + 1) === 40
      shapeEnd = findMatchingMermaidShapeEnd(source, index, 41, isDoubleParen)
    }
    if (shapeEnd > index) {
      count += 1
      index = shapeEnd
    } else {
      index += 1
    }
  }
  return count
}

export const estimateMermaidComplexity = (source: string): MermaidComplexitySummary => {
  const edgeCount = countMermaidEdgeTokens(source)
  const nodeCount = countMermaidNodeShapes(source)
  const level: MermaidComplexityLevel =
    source.length >= MERMAID_COMPLEX_SOURCE_THRESHOLD ||
    edgeCount >= MERMAID_COMPLEX_EDGE_THRESHOLD ||
    nodeCount >= MERMAID_COMPLEX_NODE_THRESHOLD
      ? "high"
      : "normal"
  return {
    level,
    edgeCount,
    nodeCount,
  }
}

const createGithubMermaidConfig = (scheme: "dark" | "light") => {
  const isDark = scheme === "dark"

  return {
    theme: "base" as const,
    darkMode: isDark,
    themeVariables: isDark
      ? {
          darkMode: true,
          background: "transparent",
          primaryColor: "#161b22",
          primaryTextColor: "#f0f6fc",
          primaryBorderColor: "#30363d",
          secondaryColor: "#161b22",
          secondaryTextColor: "#f0f6fc",
          secondaryBorderColor: "#30363d",
          tertiaryColor: "#1f2937",
          tertiaryTextColor: "#f0f6fc",
          tertiaryBorderColor: "#30363d",
          lineColor: "#8b949e",
          textColor: "#f0f6fc",
          nodeBkg: "#161b22",
          nodeBorder: "#30363d",
          mainBkg: "transparent",
          clusterBkg: "#161b22",
          clusterBorder: "#30363d",
          edgeLabelBackground: "#0d1117",
          defaultLinkColor: "#8b949e",
          actorBkg: "#161b22",
          actorBorder: "#30363d",
          actorTextColor: "#f0f6fc",
          fontFamily: GITHUB_MERMAID_FONT_STACK,
          fontSize: "14px",
        }
      : {
          darkMode: false,
          background: "transparent",
          primaryColor: "#f8fafc",
          primaryTextColor: "#0f1724",
          primaryBorderColor: "#94a3b8",
          secondaryColor: "#ffffff",
          secondaryTextColor: "#0f1724",
          secondaryBorderColor: "#cbd5e1",
          tertiaryColor: "#f1f5f9",
          tertiaryTextColor: "#0f1724",
          tertiaryBorderColor: "#cbd5e1",
          lineColor: "#475569",
          textColor: "#0f1724",
          nodeBkg: "#f8fafc",
          nodeBorder: "#94a3b8",
          mainBkg: "transparent",
          clusterBkg: "#f8fafc",
          clusterBorder: "#cbd5e1",
          edgeLabelBackground: "#ffffff",
          defaultLinkColor: "#475569",
          actorBkg: "#f8fafc",
          actorBorder: "#94a3b8",
          actorTextColor: "#0f1724",
          fontFamily: GITHUB_MERMAID_FONT_STACK,
          fontSize: "14px",
        },
    securityLevel: "strict" as const,
    suppressErrorRendering: true,
    htmlLabels: true,
    flowchart: {
      curve: "linear" as const,
      useMaxWidth: true,
      padding: 14,
      diagramPadding: 8,
    },
  }
}

const createServiceMermaidConfig = (scheme: "dark" | "light") => ({
  theme: scheme === "dark" ? ("dark" as const) : ("neutral" as const),
  securityLevel: "strict" as const,
  suppressErrorRendering: true,
  htmlLabels: true,
  flowchart: {
    curve: "linear" as const,
    useMaxWidth: true,
    padding: 20,
  },
})

export const resolveMermaidPreset = (scheme: "dark" | "light"): MermaidRuntimePreset => {
  if (MERMAID_VISUAL_PRESET === "github") {
    return {
      mode: "github" as const,
      themeKey: `github-${scheme}`,
      config: createGithubMermaidConfig(scheme),
    }
  }

  return {
    mode: "service" as const,
    themeKey: `service-${scheme}`,
    config: createServiceMermaidConfig(scheme),
  }
}

export const formatMermaidErrorReason = (
  error: unknown,
  fallback = "Mermaid parse error"
): string => {
  if (typeof error === "string") {
    const trimmed = error.trim()
    return trimmed || fallback
  }
  if (error instanceof Error) {
    return error.message.trim() || error.name || fallback
  }
  if (typeof error === "number" || typeof error === "boolean") {
    return String(error)
  }
  return fallback
}

export const renderMermaidInstanceWithTimeout = async (
  mermaidInstance: MermaidRuntimeInstance,
  renderId: string,
  sourceToRender: string,
  timeoutMs = MERMAID_RENDER_TIMEOUT_MS
): Promise<{ svg: string }> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const timed = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`MERMAID_RENDER_TIMEOUT:${timeoutMs}`)),
        timeoutMs
      )
    })
    return await Promise.race([
      Promise.resolve(mermaidInstance.render(renderId, sourceToRender)),
      timed,
    ])
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

let sharedMermaidPromise: Promise<MermaidRuntimeInstance> | null = null
let lastInitializedThemeKey: string | null = null
let activeMermaidParseWarningHandler: ((error: unknown) => void) | null = null
let mermaidExecutionQueue: Promise<unknown> = Promise.resolve()

export const resetSharedMermaidRuntimeForTests = () => {
  sharedMermaidPromise = null
  lastInitializedThemeKey = null
  activeMermaidParseWarningHandler = null
  mermaidExecutionQueue = Promise.resolve()
}

const ensureSharedMermaidInstance = (
  runtimeLoader?: () => Promise<unknown>
): Promise<MermaidRuntimeInstance> => {
  if (!sharedMermaidPromise) {
    const loadModule = runtimeLoader ?? (() => import("mermaid"))
    sharedMermaidPromise = loadModule()
      .then((loaded) => {
        const rawRuntime =
          loaded && typeof loaded === "object" && "default" in loaded
            ? (loaded as { default: unknown }).default
            : loaded
        const mermaidRuntime = rawRuntime as MermaidRuntimeInstance
        mermaidRuntime.parseError = (error) => {
          activeMermaidParseWarningHandler?.(error)
        }
        return mermaidRuntime
      })
      .catch((error) => {
        sharedMermaidPromise = null
        throw error
      })
  }
  return sharedMermaidPromise
}

const applyMermaidThemePreset = (
  mermaidRuntime: MermaidRuntimeInstance,
  preset: MermaidRuntimePreset
) => {
  if (lastInitializedThemeKey === preset.themeKey) return
  mermaidRuntime.initialize({
    startOnLoad: false,
    ...preset.config,
  })
  lastInitializedThemeKey = preset.themeKey
}

export const runSerializedMermaidTask = <T>(
  scheme: "dark" | "light",
  onParseWarning: ((error: unknown) => void) | undefined,
  task: (ctx: { mermaidRuntime: MermaidRuntimeInstance; preset: MermaidRuntimePreset }) => Promise<T>,
  runtimeLoader?: () => Promise<unknown>
): Promise<T> => {
  const scheduled = mermaidExecutionQueue.then(async () => {
    const preset = resolveMermaidPreset(scheme)
    const mermaidRuntime = await ensureSharedMermaidInstance(runtimeLoader)
    activeMermaidParseWarningHandler = onParseWarning ?? null
    try {
      applyMermaidThemePreset(mermaidRuntime, preset)
      return await task({ mermaidRuntime, preset })
    } finally {
      activeMermaidParseWarningHandler = null
    }
  })
  mermaidExecutionQueue = scheduled.then(
    () => undefined,
    () => undefined
  )
  return scheduled
}

export const loadSharedMermaidRuntime = (
  scheme: "dark" | "light",
  onParseWarning?: (error: unknown) => void,
  runtimeLoader?: () => Promise<unknown>
): Promise<{ mermaidRuntime: MermaidRuntimeInstance; preset: MermaidRuntimePreset }> =>
  runSerializedMermaidTask(
    scheme,
    onParseWarning,
    (ctx) => Promise.resolve(ctx),
    runtimeLoader
  )

export const renderSerializedMermaidSvg = async ({
  scheme,
  renderId,
  source,
  runtimeLoader,
  timeoutMs = MERMAID_RENDER_TIMEOUT_MS,
}: {
  scheme: "dark" | "light"
  renderId: string
  source: string
  runtimeLoader?: () => Promise<unknown>
  timeoutMs?: number
}): Promise<{ svg: string; preset: MermaidRuntimePreset }> => {
  let taskParseWarning: string | null = null
  return runSerializedMermaidTask(
    scheme,
    (error) => {
      taskParseWarning = formatMermaidErrorReason(error)
    },
    async ({ mermaidRuntime, preset }) => {
      taskParseWarning = null
      const rendered = await renderMermaidInstanceWithTimeout(
        mermaidRuntime,
        renderId,
        source,
        timeoutMs
      )
      if (taskParseWarning) {
        throw new Error(taskParseWarning)
      }
      return { svg: rendered.svg, preset }
    },
    runtimeLoader
  )
}
