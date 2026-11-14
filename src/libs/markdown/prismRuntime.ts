import Prism from "prismjs"
import "prismjs/components/prism-markup.js"
import "prismjs/components/prism-markup-templating.js"
import "prismjs/components/prism-clike.js"
import "prismjs/components/prism-css.js"
import "prismjs/components/prism-javascript.js"
import "prismjs/components/prism-jsx.js"
import "prismjs/components/prism-typescript.js"
import "prismjs/components/prism-tsx.js"
import "prismjs/components/prism-bash.js"
import "prismjs/components/prism-json.js"
import "prismjs/components/prism-yaml.js"
import "prismjs/components/prism-markdown.js"
import "prismjs/components/prism-sql.js"
import "prismjs/components/prism-python.js"
import "prismjs/components/prism-java.js"
import "prismjs/components/prism-kotlin.js"

export type PrismLike = {
  languages?: Record<string, unknown>
  manual?: boolean
  highlightElement: (element: Element) => void
  highlight?: (text: string, grammar: unknown, language: string) => string
}

const prismRuntime = Prism as PrismLike
prismRuntime.manual = true
;(globalThis as { Prism?: PrismLike }).Prism = prismRuntime

let prismLoader: Promise<PrismLike> | null = null
const loadedLoaders = new Set<() => Promise<unknown>>()
const failedLoaders = new Set<() => Promise<unknown>>()

const prismGrammarAliases: Record<string, string[]> = {
  html: ["markup"],
  xml: ["markup"],
  svg: ["markup"],
  js: ["javascript"],
  ts: ["typescript"],
  sh: ["bash"],
  shell: ["bash"],
  yml: ["yaml"],
  md: ["markdown"],
  py: ["python"],
  kt: ["kotlin"],
}

const prismLanguageLoaders: Record<string, (() => Promise<unknown>)[]> = {
  markup: [() => import("prismjs/components/prism-markup.js")],
  html: [() => import("prismjs/components/prism-markup.js")],
  xml: [() => import("prismjs/components/prism-markup.js")],
  svg: [() => import("prismjs/components/prism-markup.js")],
  javascript: [
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
  ],
  js: [
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
  ],
  jsx: [
    () => import("prismjs/components/prism-markup.js"),
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
    () => import("prismjs/components/prism-jsx.js"),
  ],
  typescript: [
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
    () => import("prismjs/components/prism-typescript.js"),
  ],
  ts: [
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
    () => import("prismjs/components/prism-typescript.js"),
  ],
  tsx: [
    () => import("prismjs/components/prism-markup.js"),
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-javascript.js"),
    () => import("prismjs/components/prism-typescript.js"),
    () => import("prismjs/components/prism-jsx.js"),
    () => import("prismjs/components/prism-tsx.js"),
  ],
  bash: [() => import("prismjs/components/prism-bash.js")],
  shell: [() => import("prismjs/components/prism-bash.js")],
  sh: [() => import("prismjs/components/prism-bash.js")],
  c: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-c.js")],
  cpp: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-cpp.js")],
  "c++": [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-cpp.js")],
  csharp: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-csharp.js")],
  cs: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-csharp.js")],
  diff: [() => import("prismjs/components/prism-diff.js")],
  docker: [() => import("prismjs/components/prism-docker.js")],
  dockerfile: [() => import("prismjs/components/prism-docker.js")],
  git: [() => import("prismjs/components/prism-git.js")],
  go: [() => import("prismjs/components/prism-go.js")],
  groovy: [() => import("prismjs/components/prism-groovy.js")],
  gradle: [() => import("prismjs/components/prism-gradle.js")],
  graphql: [() => import("prismjs/components/prism-graphql.js")],
  handlebars: [
    () => import("prismjs/components/prism-markup-templating.js"),
    () => import("prismjs/components/prism-handlebars.js"),
  ],
  java: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-java.js")],
  kotlin: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-kotlin.js")],
  kt: [() => import("prismjs/components/prism-clike.js"), () => import("prismjs/components/prism-kotlin.js")],
  less: [() => import("prismjs/components/prism-less.js")],
  makefile: [() => import("prismjs/components/prism-makefile.js")],
  markdown: [() => import("prismjs/components/prism-markdown.js")],
  md: [() => import("prismjs/components/prism-markdown.js")],
  objectivec: [() => import("prismjs/components/prism-objectivec.js")],
  objc: [() => import("prismjs/components/prism-objectivec.js")],
  ocaml: [() => import("prismjs/components/prism-ocaml.js")],
  python: [() => import("prismjs/components/prism-python.js")],
  py: [() => import("prismjs/components/prism-python.js")],
  reason: [() => import("prismjs/components/prism-reason.js")],
  rust: [() => import("prismjs/components/prism-rust.js")],
  rs: [() => import("prismjs/components/prism-rust.js")],
  sass: [() => import("prismjs/components/prism-sass.js")],
  scss: [() => import("prismjs/components/prism-scss.js")],
  solidity: [() => import("prismjs/components/prism-solidity.js")],
  sol: [() => import("prismjs/components/prism-solidity.js")],
  sql: [() => import("prismjs/components/prism-sql.js")],
  stylus: [() => import("prismjs/components/prism-stylus.js")],
  swift: [() => import("prismjs/components/prism-swift.js")],
  wasm: [() => import("prismjs/components/prism-wasm.js")],
  yaml: [() => import("prismjs/components/prism-yaml.js")],
  yml: [() => import("prismjs/components/prism-yaml.js")],
}

export const normalizePrismLanguage = (className: string) =>
  className.replace("language-", "").trim().toLowerCase()

const resolvePrismLanguage = (source: string, language?: string | null) => {
  const normalizedLanguage = normalizePrismLanguage(language || "")
  return isGenericLanguage(normalizedLanguage)
    ? inferPrismLanguageFromSource(source)
    : normalizedLanguage
}

export const inferPrismLanguageFromSource = (rawValue: string): string => {
  const trimmed = rawValue.trim()
  if (!trimmed) return "text"
  const sample = trimmed.length > 4096 ? trimmed.slice(0, 4096) : trimmed

  if (/^[{[]/.test(sample) && /[}\]]$/.test(trimmed) && /"\s*:/.test(sample)) return "json"
  if (/(^|\n)\s*(fun|val|var|data class|object|companion object)\b/.test(sample)) return "kotlin"
  if (/(^|\n)\s*(public|private|protected)\s+(class|interface|enum)\b/.test(sample)) return "java"
  if (/(^|\n)\s*(interface|type)\s+\w+/.test(sample) || /:\s*(string|number|boolean|unknown|any)\b/.test(sample))
    return "typescript"
  if (/(^|\n)\s*(const|let|var)\s+\w+\s*=/.test(sample) || /=>/.test(sample)) return "javascript"
  if (/(^|\n)\s*def\s+\w+\(/.test(sample) || /(^|\n)\s*class\s+\w+\s*:\s*$/.test(sample)) return "python"
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sample)) return "sql"
  if (/^#!/.test(sample) || /(^|\n)\s*(echo|grep|awk|sed|curl|export)\b/.test(sample)) return "bash"
  if (/(^|\n)\s*<([A-Za-z][\w:-]*)(\s|>)/.test(sample) && /<\/[A-Za-z][\w:-]*>/.test(sample)) return "markup"
  if (/(^|\n)\s*[-\w]+\s*:\s*.+/.test(sample) && !/[;{}()]/.test(sample)) return "yaml"

  return "text"
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const normalizeCodeLineBreaks = (value: string) => value.replace(/\r\n?|\u2028|\u2029/g, "\n")

// 참조 구현: @shikijs/transformers `transformerNotationDiff` (https://github.com/shikijs/shiki, MIT License)
// 줄 끝 주석의 `[!code ++]`, `[!code --]`, `[!code highlight]` 지시자를 단일 패스로 분리한다.
const CODE_ANNOTATION_MARKER_PATTERN =
  /(?:\s*(?:\/\/|--|#)\s*|\s*\/\*\s*|\s*<!--\s*)\[!code\s+(\+\+|--|highlight)\]\s*(?:\*\/|-->)?\s*$/

export type CodeDiffKind = "add" | "remove"

export type CodeLineAnnotationResult = {
  cleanSource: string
  diffLines: ReadonlyMap<number, CodeDiffKind>
  highlightedLines: ReadonlySet<number>
  hasAnnotations: boolean
}

export const extractCodeLineAnnotations = (source: string): CodeLineAnnotationResult => {
  const normalized = normalizeCodeLineBreaks(source)
  if (!normalized.includes("[!code ")) {
    return {
      cleanSource: normalized,
      diffLines: new Map<number, CodeDiffKind>(),
      highlightedLines: new Set<number>(),
      hasAnnotations: false,
    }
  }

  const diffLines = new Map<number, CodeDiffKind>()
  const highlightedLines = new Set<number>()
  let cleanSource = ""
  let lineStart = 0
  let lineNumber = 1
  let hasAnnotations = false

  while (lineStart <= normalized.length) {
    const lineEnd = normalized.indexOf("\n", lineStart)
    const rawLine =
      lineEnd === -1 ? normalized.slice(lineStart) : normalized.slice(lineStart, lineEnd)
    const match = CODE_ANNOTATION_MARKER_PATTERN.exec(rawLine)
    if (match) {
      hasAnnotations = true
      const directive = match[1]
      if (directive === "++") {
        diffLines.set(lineNumber, "add")
      } else if (directive === "--") {
        diffLines.set(lineNumber, "remove")
      } else if (directive === "highlight") {
        highlightedLines.add(lineNumber)
      }
      cleanSource += rawLine.slice(0, match.index)
    } else {
      cleanSource += rawLine
    }
    if (lineEnd === -1) break
    cleanSource += "\n"
    lineStart = lineEnd + 1
    lineNumber += 1
  }

  return {
    cleanSource,
    diffLines,
    highlightedLines,
    hasAnnotations,
  }
}

const mergeHighlightedLineSets = (
  a?: ReadonlySet<number>,
  b?: ReadonlySet<number>
): ReadonlySet<number> | undefined => {
  if ((!a || a.size === 0) && (!b || b.size === 0)) return undefined
  if (!a || a.size === 0) return b
  if (!b || b.size === 0) return a
  const merged = new Set<number>(a)
  for (const line of b) merged.add(line)
  return merged
}

export const renderLineWrappedHtml = (
  source: string,
  highlightedLines?: ReadonlySet<number>,
  diffLines?: ReadonlyMap<number, CodeDiffKind>
) => {
  const html = normalizeCodeLineBreaks(source)
  const hasHighlights = Boolean(highlightedLines && highlightedLines.size > 0)
  const hasDiffs = Boolean(diffLines && diffLines.size > 0)
  let result = ""
  let lineStart = 0
  let lineNumber = 1

  while (lineStart <= html.length) {
    const lineEnd = html.indexOf("\n", lineStart)
    const line = lineEnd === -1 ? html.slice(lineStart) : html.slice(lineStart, lineEnd)
    const highlightedAttr =
      hasHighlights && highlightedLines!.has(lineNumber)
        ? ' data-highlighted-line="true"'
        : ""
    const diffKind = hasDiffs ? diffLines!.get(lineNumber) : undefined
    const diffAttr = diffKind ? ` data-diff="${diffKind}"` : ""
    result += `<span class="line" data-line="true"${highlightedAttr}${diffAttr}>${
      line.length > 0 ? line : "<br />"
    }</span>`
    if (lineEnd === -1) break
    lineStart = lineEnd + 1
    lineNumber += 1
  }

  return result
}

export const renderPlainCodeToHtml = (
  source: string,
  highlightedLines?: ReadonlySet<number>,
  diffLines?: ReadonlyMap<number, CodeDiffKind>
) => renderLineWrappedHtml(escapeHtml(source), highlightedLines, diffLines)

export const loadPrismCore = async () => {
  if (!prismLoader) {
    prismLoader = Promise.resolve(Prism as PrismLike)
  }

  return prismLoader
}

export const ensurePrismLanguages = async (languages: string[]) => {
  const uniqueLanguages = Array.from(new Set(languages.map(normalizePrismLanguage)))

  for (const language of uniqueLanguages) {
    const loaders = prismLanguageLoaders[language] || []

    for (const load of loaders) {
      if (loadedLoaders.has(load)) continue
      if (failedLoaders.has(load)) continue
      try {
        await load()
        loadedLoaders.add(load)
      } catch (error) {
        failedLoaders.add(load)
        console.warn(`[prism] language loader failed: ${language}`, error)
      }
    }
  }
}

const isGenericLanguage = (language: string) => ["", "text", "plain", "plaintext", "txt"].includes(language)

const resolvePrismGrammar = (language: string) => {
  const prismLanguages = (Prism as PrismLike).languages || {}
  const candidates = [language, ...(prismGrammarAliases[language] || [])]

  for (const candidate of candidates) {
    const grammar = prismLanguages[candidate]
    if (grammar) return grammar
  }

  return null
}

const highlightWithPrism = (
  source: string,
  language: string,
  highlightedLines?: ReadonlySet<number>,
  diffLines?: ReadonlyMap<number, CodeDiffKind>
) => {
  const grammar = resolvePrismGrammar(language)
  if (!grammar || typeof (Prism as PrismLike).highlight !== "function") return null
  return renderLineWrappedHtml(
    (Prism as PrismLike).highlight!(source, grammar, language),
    highlightedLines,
    diffLines
  )
}

export type RenderImmediateCodeOptions = {
  source: string
  language?: string | null
  highlightedLines?: ReadonlySet<number>
  diffLines?: ReadonlyMap<number, CodeDiffKind>
}

export const renderImmediateCodeToHtml = (
  inputOrSource: RenderImmediateCodeOptions | string,
  maybeLanguage?: string | null,
  maybeOptions?: {
    showLineNumbers?: boolean
    highlightedLines?: ReadonlySet<number>
    diffLines?: ReadonlyMap<number, CodeDiffKind>
  }
) => {
  const rawSource =
    typeof inputOrSource === "string" ? inputOrSource : inputOrSource.source
  const language =
    typeof inputOrSource === "string" ? maybeLanguage : inputOrSource.language
  const inputHighlightedLines =
    typeof inputOrSource === "string"
      ? maybeOptions?.highlightedLines
      : inputOrSource.highlightedLines
  const inputDiffLines =
    typeof inputOrSource === "string" ? maybeOptions?.diffLines : inputOrSource.diffLines

  const annotations = extractCodeLineAnnotations(rawSource)
  const source = annotations.cleanSource
  const highlightedLines = mergeHighlightedLineSets(
    inputHighlightedLines,
    annotations.highlightedLines
  )
  const diffLines =
    inputDiffLines && inputDiffLines.size > 0 ? inputDiffLines : annotations.diffLines
  const hasDiff = diffLines.size > 0
  const resolvedLanguage = resolvePrismLanguage(source, language)

  if (resolvedLanguage === "mermaid" || resolvedLanguage === "text") {
    return {
      language: resolvedLanguage,
      highlighted: false,
      html: renderPlainCodeToHtml(source, highlightedLines, diffLines),
      cleanSource: source,
      hasDiff,
    }
  }

  const html = highlightWithPrism(source, resolvedLanguage, highlightedLines, diffLines)
  if (!html) {
    return {
      language: resolvedLanguage,
      highlighted: false,
      html: renderPlainCodeToHtml(source, highlightedLines, diffLines),
      cleanSource: source,
      hasDiff,
    }
  }

  return {
    language: resolvedLanguage,
    highlighted: true,
    html,
    cleanSource: source,
    hasDiff,
  }
}

export const highlightCodeToHtml = async ({
  source: rawSource,
  language,
  highlightedLines: inputHighlightedLines,
  diffLines: inputDiffLines,
}: {
  source: string
  language?: string | null
  highlightedLines?: ReadonlySet<number>
  diffLines?: ReadonlyMap<number, CodeDiffKind>
}) => {
  const annotations = extractCodeLineAnnotations(rawSource)
  const source = annotations.cleanSource
  const highlightedLines = mergeHighlightedLineSets(
    inputHighlightedLines,
    annotations.highlightedLines
  )
  const diffLines =
    inputDiffLines && inputDiffLines.size > 0 ? inputDiffLines : annotations.diffLines
  const hasDiff = diffLines.size > 0
  const resolvedLanguage = resolvePrismLanguage(source, language)

  if (resolvedLanguage === "mermaid" || resolvedLanguage === "text") {
    return {
      language: resolvedLanguage,
      highlighted: false,
      html: renderPlainCodeToHtml(source, highlightedLines, diffLines),
      cleanSource: source,
      hasDiff,
    }
  }

  const immediateResult = renderImmediateCodeToHtml({
    source,
    language: resolvedLanguage,
    highlightedLines,
    diffLines,
  })
  if (immediateResult.highlighted) {
    return immediateResult
  }

  const loadedPrism = await loadPrismCore()
  await ensurePrismLanguages([resolvedLanguage])

  const grammar = loadedPrism.languages?.[resolvedLanguage]
  if (!grammar || typeof loadedPrism.highlight !== "function") {
    return {
      language: resolvedLanguage,
      highlighted: false,
      html: renderPlainCodeToHtml(source, highlightedLines, diffLines),
      cleanSource: source,
      hasDiff,
    }
  }

  return {
    language: resolvedLanguage,
    highlighted: true,
    html: renderLineWrappedHtml(
      loadedPrism.highlight(source, grammar, resolvedLanguage),
      highlightedLines,
      diffLines
    ),
    cleanSource: source,
    hasDiff,
  }
}
