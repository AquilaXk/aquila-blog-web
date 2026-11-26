/**
 * 참조 구현:
 * - CodeMirror @codemirror/language StreamLanguage (`codemirror/language`, MIT License)
 * - PrismJS languages (`PrismJS/prism`, MIT License)
 */
import { LanguageDescription, LanguageSupport, StreamLanguage, type StringStream } from "@codemirror/language"
import { cssLanguage } from "@codemirror/lang-css"
import { htmlLanguage } from "@codemirror/lang-html"
import { javascriptLanguage, jsxLanguage, tsxLanguage, typescriptLanguage } from "@codemirror/lang-javascript"
import { ensurePrismLanguages } from "../../libs/markdown/prismRuntime"

export type CodeBlockLanguageOption = {
  value: string
  label: string
}

export const CODE_BLOCK_LANGUAGE_OPTIONS: readonly CodeBlockLanguageOption[] = [
  { value: "", label: "Plain Text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "kotlin", label: "Kotlin" },
  { value: "java", label: "Java" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "diff", label: "Diff" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "swift", label: "Swift" },
  { value: "graphql", label: "GraphQL" },
  { value: "markdown", label: "Markdown" },
]

type JsonStreamState = { inBlockComment: boolean }

const readJsonQuotedString = (stream: StringStream): boolean => {
  stream.next()
  while (!stream.eol()) {
    const ch = stream.next()
    if (ch === "\\") {
      if (!stream.eol()) stream.next()
      continue
    }
    if (ch === "\"") return true
  }
  return false
}

export const jsonStreamLanguage = StreamLanguage.define<JsonStreamState>({
  name: "json",
  startState: () => ({ inBlockComment: false }),
  copyState: (s) => ({ inBlockComment: s.inBlockComment }),
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.skipTo("*/")) {
        stream.match("*/")
        state.inBlockComment = false
      } else {
        stream.skipToEnd()
      }
      return "comment"
    }
    if (stream.eatSpace()) return null
    if (stream.match("//")) {
      stream.skipToEnd()
      return "comment"
    }
    if (stream.match("/*")) {
      state.inBlockComment = true
      return "comment"
    }
    if (stream.peek() === "\"") {
      readJsonQuotedString(stream)
      const tail = stream.string.slice(stream.pos)
      return /^\s*:/.test(tail) ? "propertyName" : "string"
    }
    if (stream.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return "number"
    if (stream.match(/^(?:true|false)\b/)) return "bool"
    if (stream.match(/^null\b/)) return "atom"
    if (stream.match(/^[{}\[\],:]/)) return "punctuation"
    stream.next()
    return null
  },
})

type FlatPrismToken = { len: number; tag: string | null }
type PrismTokenLike = string | { type?: string; content?: unknown; alias?: string | string[] }
type PrismState = {
  lineRef: string | null
  tokens: FlatPrismToken[]
  cursor: number
  inBlockComment: boolean
}

const PRISM_TOKEN_TAG_MAP: Record<string, string> = {
  keyword: "keyword",
  "atrule": "keyword",
  "rule": "keyword",
  "selector": "keyword",
  function: "variableName.definition",
  "function-variable": "variableName.definition",
  method: "variableName.definition",
  "class-name": "typeName",
  builtin: "typeName",
  namespace: "typeName",
  string: "string",
  char: "string",
  "template-string": "string",
  "attr-value": "string",
  regex: "string2",
  number: "number",
  boolean: "bool",
  constant: "atom",
  symbol: "atom",
  comment: "comment",
  prolog: "comment",
  doctype: "meta",
  operator: "operator",
  property: "propertyName",
  "attr-name": "propertyName",
  key: "propertyName",
  variable: "variableName",
  parameter: "variableName",
  inserted: "inserted",
  deleted: "deleted",
  coord: "meta",
  punctuation: "punctuation",
  tag: "keyword",
  decorator: "macroName",
  annotation: "macroName",
}

const resolvePrismTag = (type?: string, alias?: string | string[], inherited: string | null = null): string | null => {
  if (type && PRISM_TOKEN_TAG_MAP[type]) return PRISM_TOKEN_TAG_MAP[type]
  if (typeof alias === "string" && PRISM_TOKEN_TAG_MAP[alias]) return PRISM_TOKEN_TAG_MAP[alias]
  if (Array.isArray(alias)) {
    for (const candidate of alias) {
      if (PRISM_TOKEN_TAG_MAP[candidate]) return PRISM_TOKEN_TAG_MAP[candidate]
    }
  }
  return inherited
}

const flattenPrismTokens = (
  items: readonly PrismTokenLike[],
  inherited: string | null,
  out: FlatPrismToken[]
): void => {
  for (const item of items) {
    if (typeof item === "string") {
      if (item.length > 0) out.push({ len: item.length, tag: inherited })
      continue
    }
    const tag = resolvePrismTag(item.type, item.alias, inherited)
    if (typeof item.content === "string") {
      if (item.content.length > 0) out.push({ len: item.content.length, tag })
    } else if (Array.isArray(item.content)) {
      flattenPrismTokens(item.content as PrismTokenLike[], tag, out)
    }
  }
}

const plainFallbackLanguage = StreamLanguage.define<Record<string, never>>({
  name: "plaintext",
  startState: () => ({}),
  token(stream) {
    stream.skipToEnd()
    return null
  },
})

export const createPrismStreamLanguage = (
  name: string,
  grammar: unknown,
  tokenize: (text: string, grammarObj: unknown) => PrismTokenLike[],
  supportsCBlockComments = false
) =>
  StreamLanguage.define<PrismState>({
    name,
    startState: () => ({ lineRef: null, tokens: [], cursor: 0, inBlockComment: false }),
    copyState: (s) => ({
      lineRef: s.lineRef,
      tokens: s.tokens,
      cursor: s.cursor,
      inBlockComment: s.inBlockComment,
    }),
    token(stream, state) {
      if (supportsCBlockComments && state.inBlockComment) {
        if (stream.skipTo("*/")) {
          stream.match("*/")
          state.inBlockComment = false
        } else {
          stream.skipToEnd()
        }
        return "comment"
      }
      if (stream.pos === 0 || state.lineRef !== stream.string) {
        const out: FlatPrismToken[] = []
        flattenPrismTokens(tokenize(stream.string, grammar), null, out)
        state.lineRef = stream.string
        state.tokens = out
        state.cursor = 0
      }
      if (supportsCBlockComments && stream.match("/*")) {
        if (!stream.skipTo("*/")) {
          stream.skipToEnd()
          state.inBlockComment = true
        } else {
          stream.match("*/")
        }
        return "comment"
      }
      if (state.cursor >= state.tokens.length) {
        stream.skipToEnd()
        return null
      }
      const nextTok = state.tokens[state.cursor++]
      const targetPos = Math.min(stream.string.length, stream.pos + nextTok.len)
      if (targetPos <= stream.pos) {
        stream.next()
        return null
      }
      stream.pos = targetPos
      return nextTok.tag
    },
  })

const lazyPrismDescription = (
  name: string,
  alias: string[],
  prismKey: string,
  supportsCBlockComments = false
) =>
  LanguageDescription.of({
    name,
    alias,
    async load() {
      await ensurePrismLanguages([prismKey])
      const prismModule = await import("prismjs")
      const prismObj = (prismModule.default ?? prismModule) as unknown as {
        languages?: Record<string, unknown>
        tokenize?: (text: string, grammar: unknown) => PrismTokenLike[]
      }
      const grammar = prismObj.languages?.[prismKey]
      if (!grammar || typeof prismObj.tokenize !== "function") {
        return new LanguageSupport(plainFallbackLanguage)
      }
      return new LanguageSupport(
        createPrismStreamLanguage(name, grammar, prismObj.tokenize, supportsCBlockComments)
      )
    },
  })

export const codeLanguages: LanguageDescription[] = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "mjs", "cjs"],
    support: new LanguageSupport(javascriptLanguage),
  }),
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts"],
    support: new LanguageSupport(typescriptLanguage),
  }),
  LanguageDescription.of({
    name: "jsx",
    support: new LanguageSupport(jsxLanguage),
  }),
  LanguageDescription.of({
    name: "tsx",
    support: new LanguageSupport(tsxLanguage),
  }),
  LanguageDescription.of({
    name: "html",
    alias: ["xml", "svg", "htm"],
    support: new LanguageSupport(htmlLanguage),
  }),
  LanguageDescription.of({
    name: "css",
    support: new LanguageSupport(cssLanguage),
  }),
  LanguageDescription.of({
    name: "json",
    alias: ["json5", "jsonc"],
    support: new LanguageSupport(jsonStreamLanguage),
  }),
  lazyPrismDescription("kotlin", ["kt", "kts"], "kotlin", true),
  lazyPrismDescription("java", [], "java", true),
  lazyPrismDescription("python", ["py"], "python", false),
  lazyPrismDescription("sql", ["postgres", "mysql", "sqlite"], "sql", true),
  lazyPrismDescription("go", ["golang"], "go", true),
  lazyPrismDescription("rust", ["rs"], "rust", true),
  lazyPrismDescription("yaml", ["yml"], "yaml", false),
  lazyPrismDescription("bash", ["sh", "shell", "zsh"], "bash", false),
  lazyPrismDescription("diff", ["patch"], "diff", false),
  lazyPrismDescription("dockerfile", ["docker"], "docker", false),
  lazyPrismDescription("c", [], "c", true),
  lazyPrismDescription("cpp", ["c++", "cc", "cxx"], "cpp", true),
  lazyPrismDescription("csharp", ["cs"], "csharp", true),
  lazyPrismDescription("swift", [], "swift", true),
  lazyPrismDescription("graphql", ["gql"], "graphql", false),
  lazyPrismDescription("scss", ["sass"], "scss", true),
  lazyPrismDescription("markdown", ["md"], "markdown", false),
  lazyPrismDescription("groovy", ["gradle"], "groovy", true),
  lazyPrismDescription("makefile", ["make"], "makefile", false),
]
