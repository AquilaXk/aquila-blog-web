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
  const match = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(lineText)
  if (!match) return { fence, isFenceLine: false }
  if (!fence) return { fence: match[1]!, isFenceLine: true }
  const closes =
    match[1]![0] === fence[0] && match[1]!.length >= fence.length && !match[2]?.trim()
  return { fence: closes ? "" : fence, isFenceLine: true }
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

    const headingMatch = /^#{1,6}[ \t]+([^\r\n]+)$/.exec(lineText)
    const title = headingMatch?.[1]?.trim() ?? ""
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
