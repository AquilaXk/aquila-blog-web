import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete"

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
    options: CORE_CODE_LANGUAGES.map((lang) => ({
      label: lang.label,
      type: "type",
      detail: lang.detail,
    })),
    filter: true,
  }
}

export const wikilinkCompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)
  const match = /\[\[([^\]\n]*)$/.exec(textBefore)
  if (!match) return null

  const query = match[1]?.toLowerCase() ?? ""
  const startPos = line.from + textBefore.length - (match[1]?.length ?? 0)

  // Collect headings from the current document as wikilink targets
  const docText = context.state.doc.toString()
  const headingMatches = Array.from(docText.matchAll(/^#{1,6}\s+(.+)$/gm))
  const headingOptions = headingMatches.map((m) => {
    const title = m[1]?.trim() ?? ""
    return {
      label: `#${title}`,
      type: "text",
      detail: "Heading link",
      apply: `#${title}]]`,
    }
  })

  const defaultNoteOptions = [
    { label: "Overview", type: "text", detail: "Note link", apply: "Overview]]" },
    { label: "Architecture", type: "text", detail: "Note link", apply: "Architecture]]" },
    { label: "Guide", type: "text", detail: "Note link", apply: "Guide]]" },
    { label: "Development", type: "text", detail: "Note link", apply: "Development]]" },
  ]

  const allOptions = [...headingOptions, ...defaultNoteOptions]

  return {
    from: startPos,
    options: allOptions,
    filter: true,
  }
}
