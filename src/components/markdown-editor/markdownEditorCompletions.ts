import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete"

export const CORE_CODE_LANGUAGES = [
  { label: "typescript", detail: "TypeScript (ts)" },
  { label: "javascript", detail: "JavaScript (js)" },
  { label: "tsx", detail: "React TypeScript (tsx)" },
  { label: "jsx", detail: "React JavaScript (jsx)" },
  { label: "html", detail: "HTML" },
  { label: "css", detail: "CSS" },
  { label: "json", detail: "JSON" },
  { label: "markdown", detail: "Markdown" },
  { label: "python", detail: "Python" },
  { label: "bash", detail: "Bash / Shell" },
  { label: "shell", detail: "Shell script" },
  { label: "yaml", detail: "YAML" },
  { label: "sql", detail: "SQL" },
  { label: "rust", detail: "Rust" },
  { label: "go", detail: "Go" },
]

const CORE_CODE_LANGUAGE_OPTIONS: Completion[] = CORE_CODE_LANGUAGES.map((lang) => ({
  label: lang.label,
  type: "type",
  detail: lang.detail,
}))

export const codeLanguageCompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)
  const match = /^(?: {0,3})`{3}([a-zA-Z0-9_-]*)$/.exec(textBefore)
  if (!match) return null

  const query = match[1]?.toLowerCase() ?? ""
  const startPos = line.from + textBefore.length - query.length

  return {
    from: startPos,
    options: CORE_CODE_LANGUAGE_OPTIONS,
    filter: true,
  }
}

export type InternalPostSuggestion = {
  title: string
  slug?: string
  id?: number | string
}

let registeredPostSuggestions: InternalPostSuggestion[] = []
let wikilinkPostCompletionOptions: Completion[] = []

export const registerInternalPostSuggestions = (posts: InternalPostSuggestion[]) => {
  registeredPostSuggestions = posts
  wikilinkPostCompletionOptions = posts.map((post) => ({
    label: post.title,
    type: "text",
    detail: post.slug ? `Blog post (/posts/${post.slug})` : "Blog post",
    apply: `${post.title}]]`,
  }))
}

export const getRegisteredPostSuggestions = () => registeredPostSuggestions

export const clearRegisteredPostSuggestions = () => {
  registeredPostSuggestions = []
  wikilinkPostCompletionOptions = []
}

const headingCompletionsCache = new WeakMap<object, Completion[]>()

const stepCompletionFence = (
  fence: string,
  lineText: string
): { fence: string; isFenceLine: boolean } => {
  let cursor = 0
  while (cursor < 3 && lineText[cursor] === " ") {
    cursor += 1
  }
  const marker = lineText[cursor]
  if (marker !== "`" && marker !== "~") {
    return { fence, isFenceLine: false }
  }
  const runStart = cursor
  while (lineText[cursor] === marker) {
    cursor += 1
  }
  const fenceRun = lineText.slice(runStart, cursor)
  if (fenceRun.length < 3) {
    return { fence, isFenceLine: false }
  }
  if (!fence) return { fence: fenceRun, isFenceLine: true }
  const closes =
    fenceRun.startsWith(fence[0]!) &&
    fenceRun.length >= fence.length &&
    !lineText.slice(cursor).trim()
  return { fence: closes ? "" : fence, isFenceLine: true }
}

const extractHeadingCompletionTitle = (lineText: string): string => {
  let hashes = 0
  while (hashes < 6 && lineText[hashes] === "#") {
    hashes += 1
  }
  if (hashes === 0 || lineText[hashes] === "#") return ""
  let cursor = hashes
  while (lineText[cursor] === " " || lineText[cursor] === "\t") {
    cursor += 1
  }
  if (cursor === hashes) return ""
  return lineText.slice(cursor).trim()
}

const collectDocumentHeadingOptions = (doc: CompletionContext["state"]["doc"]): Completion[] => {
  const cached = headingCompletionsCache.get(doc)
  if (cached) return cached

  const options: Completion[] = []
  let activeFence = ""

  for (let lineNo = 1; lineNo <= doc.lines; lineNo += 1) {
    const lineText = doc.line(lineNo).text
    const fenceStep = stepCompletionFence(activeFence, lineText)
    activeFence = fenceStep.fence
    if (fenceStep.isFenceLine || activeFence) continue

    const title = extractHeadingCompletionTitle(lineText)
    if (title) {
      options.push({
        label: `#${title}`,
        type: "text",
        detail: "Heading link",
        apply: `#${title}]]`,
      })
    }
  }

  headingCompletionsCache.set(doc, options)
  return options
}

export const wikilinkCompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)
  const match = /\[\[([^\]\r\n]*)$/.exec(textBefore)
  if (!match) return null

  const startPos = line.from + textBefore.length - (match[1]?.length ?? 0)
  const headingOptions = collectDocumentHeadingOptions(context.state.doc)
  if (headingOptions.length === 0 && wikilinkPostCompletionOptions.length === 0) return null

  let allOptions = wikilinkPostCompletionOptions
  if (wikilinkPostCompletionOptions.length === 0) {
    allOptions = headingOptions
  } else if (headingOptions.length > 0) {
    allOptions = [...headingOptions, ...wikilinkPostCompletionOptions]
  }

  return {
    from: startPos,
    options: allOptions,
    filter: true,
  }
}
