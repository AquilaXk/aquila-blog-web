import {
  inferPrismLanguageFromSource,
  highlightCodeToHtml,
  renderImmediateCodeToHtml,
} from "src/libs/markdown/prismRuntime"
import { parseHighlightedLineNumbers } from "src/libs/markdown/renderingCodeModel"

export const PRISM_DEFAULT_MUTATION_DEBOUNCE_MS = 72
export const PRISM_INITIAL_HYDRATION_TIMEOUT_MS = 1200

type PrismScheduleRun = (options?: { fullRescan?: boolean; block?: HTMLElement }) => void

const extractLanguageFromClassList = (block: HTMLElement) =>
  Array.from(block.classList)
    .find((className) => className.startsWith("language-"))
    ?.replace("language-", "")
    .trim()
    .toLowerCase() || ""

const extractLanguage = (block: HTMLElement): string => {
  const classLanguage = extractLanguageFromClassList(block)
  if (classLanguage) return classLanguage

  const dataLanguage =
    block.getAttribute("data-language")?.trim().toLowerCase() ||
    block.closest("pre")?.getAttribute("data-language")?.trim().toLowerCase() ||
    ""
  if (dataLanguage) return dataLanguage

  return ""
}

const isGenericLanguage = (language: string) =>
  ["", "text", "plain", "plaintext", "txt"].includes(language)

const blockHasSyntaxMarkup = (block: HTMLElement) =>
  Boolean(
    block.querySelector("span.token") ||
      block.querySelector("span[style]") ||
      block.querySelector("span[data-token-type]")
  )

const extractCodeSource = (block: HTMLElement) =>
  block.getAttribute("data-raw-code") || block.dataset.prismSource || block.textContent || ""

const ensureLineWrappedHtml = ({
  html,
  language,
  source,
  highlightedLines,
}: {
  html: string
  language: string
  source: string
  highlightedLines?: ReadonlySet<number>
}) => {
  if (html.includes("data-line=")) return html
  return renderImmediateCodeToHtml({ source, language, highlightedLines }).html
}

const resolveElementFromNode = (node: Node | null): Element | null => {
  if (!node) return null
  if (node instanceof Element) return node
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement
  return null
}

const resolveCodeBlockFromNode = (node: Node | null, root: HTMLElement) => {
  const element = resolveElementFromNode(node)
  if (!element) return null
  const codeBlock = element.matches("pre > code") ? element : element.closest("pre > code")
  if (!(codeBlock instanceof HTMLElement)) return null
  if (!root.contains(codeBlock)) return null
  return codeBlock
}

const isPrismTokenNode = (node: Node | null) => {
  const element = resolveElementFromNode(node)
  if (!element) return false
  return Boolean(element.matches("span.token") || element.closest("span.token"))
}

export const isMermaidCodeBlock = (block: Element): boolean =>
  block.classList?.contains("language-mermaid") ||
  block.classList?.contains("aq-mermaid") ||
  block.getAttribute?.("data-language") === "mermaid" ||
  block.getAttribute?.("data-aq-mermaid") === "true" ||
  Boolean(
    block.closest?.("pre.aq-mermaid, pre[data-aq-mermaid='true'], pre[data-language='mermaid']")
  )

export const shouldRescanPrismOnRemovedNodes = (removedNodes: Iterable<Node>): boolean => {
  for (const node of Array.from(removedNodes)) {
    if (!node || typeof (node as Element).matches !== "function") continue
    const element = node as Element
    if (isMermaidCodeBlock(element)) continue
    if (element.matches("code")) {
      return true
    }
    if (element.matches("pre")) {
      const codeChildren = Array.from(element.querySelectorAll("code"))
      if (codeChildren.length > 0 && codeChildren.every((code) => isMermaidCodeBlock(code))) {
        continue
      }
      return true
    }
    const nestedCodeBlocks = Array.from(element.querySelectorAll("pre > code"))
    if (nestedCodeBlocks.some((block) => !isMermaidCodeBlock(block))) {
      return true
    }
  }
  return false
}

export const createPrismEffectRuntime = ({
  root,
  isDisposed,
}: {
  root: HTMLElement
  isDisposed: () => boolean
}) => {
  let fullRescanRequested = true
  const pendingBlocks = new Set<HTMLElement>()

  const requestFullRescan = () => {
    fullRescanRequested = true
  }

  const queueBlock = (block: HTMLElement) => {
    pendingBlocks.add(block)
  }

  const collectTargetBlocks = () => {
    if (fullRescanRequested) {
      fullRescanRequested = false
      pendingBlocks.clear()
      return Array.from(root.querySelectorAll<HTMLElement>("pre > code"))
    }

    const targets = Array.from(pendingBlocks).filter((block) => block.isConnected && root.contains(block))
    pendingBlocks.clear()
    return targets
  }

  const hasCodeBlockMissingLineWrappers = () =>
    Array.from(root.querySelectorAll<HTMLElement>("pre > code")).some(
      (block) => !isMermaidCodeBlock(block) && !block.querySelector("[data-line]")
    )

  const highlightCodeBlocks = async (codeBlocks: HTMLElement[]) => {
    if (!codeBlocks.length) return

    const languageByBlock = codeBlocks
      .map((block) => ({
        block,
        rawLanguage: extractLanguage(block),
        source: extractCodeSource(block),
      }))
      .map((entry) => {
        const inferred = isGenericLanguage(entry.rawLanguage)
          ? inferPrismLanguageFromSource(entry.source)
          : entry.rawLanguage
        const hasSyntaxMarkup = blockHasSyntaxMarkup(entry.block)
        const hasLineWrappers = Boolean(entry.block.querySelector("[data-line]"))

        return {
          ...entry,
          language: inferred,
          shouldHighlight:
            inferred.length > 0 &&
            inferred !== "mermaid" &&
            (!hasSyntaxMarkup || !hasLineWrappers),
          alreadyHighlighted:
            entry.block.dataset.prismLanguage === inferred &&
            entry.block.dataset.prismSource === entry.source &&
            hasLineWrappers,
        }
      })
      .filter((entry) => entry.shouldHighlight && !entry.alreadyHighlighted)

    if (!languageByBlock.length) return

    const asyncCandidates: Array<{
      block: HTMLElement
      language: string
      source: string
      highlightedLines: Set<number>
    }> = []

    for (const { block, language, source } of languageByBlock) {
      const highlightSpec = block.getAttribute("data-highlight-lines") || ""
      const highlightedLines = parseHighlightedLineNumbers(highlightSpec)
      const immediate = renderImmediateCodeToHtml({
        source,
        language,
        highlightedLines,
      })
      Array.from(block.classList)
        .filter((className) => className.startsWith("language-"))
        .forEach((className) => block.classList.remove(className))
      block.classList.add(`language-${immediate.language}`)
      block.innerHTML = ensureLineWrappedHtml({
        html: immediate.html,
        language: immediate.language,
        source,
        highlightedLines,
      })
      block.dataset.prismLanguage = immediate.language
      block.dataset.prismSource = source
      block.setAttribute("data-language", immediate.language)
      block.setAttribute("data-raw-code", source)
      if (immediate.highlighted) {
        block.setAttribute("data-prism-highlighted", "true")
        continue
      }
      asyncCandidates.push({
        block,
        language,
        source,
        highlightedLines,
      })
    }

    if (!asyncCandidates.length) return

    const highlightedBlocks = await Promise.all(
      asyncCandidates.map(async ({ block, language, source, highlightedLines }) => ({
        block,
        source,
        highlightedLines,
        result: await highlightCodeToHtml({
          source,
          language,
          highlightedLines,
        }),
      }))
    )
    if (isDisposed()) return

    highlightedBlocks.forEach(({ block, source, highlightedLines, result }) => {
      if (!block.isConnected || !root.contains(block)) return
      const language = result.language
      Array.from(block.classList)
        .filter((className) => className.startsWith("language-"))
        .forEach((className) => block.classList.remove(className))
      block.classList.add(`language-${language}`)
      block.innerHTML = ensureLineWrappedHtml({
        html: result.html,
        language,
        source,
        highlightedLines,
      })
      block.dataset.prismLanguage = language
      block.dataset.prismSource = source
      block.setAttribute("data-language", language)
      block.setAttribute("data-raw-code", source)
      if (result.highlighted) {
        block.setAttribute("data-prism-highlighted", "true")
      }
    })
  }

  const handleMutationRecords = (mutations: MutationRecord[], scheduleRun: PrismScheduleRun) => {
    let hasRelevantMutation = false
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        if (isPrismTokenNode(mutation.target)) continue
        const block = resolveCodeBlockFromNode(mutation.target, root)
        if (!block) continue
        hasRelevantMutation = true
        scheduleRun({ block })
        continue
      }

      if (mutation.type === "attributes") {
        const block = resolveCodeBlockFromNode(mutation.target, root)
        if (!block) continue
        hasRelevantMutation = true
        scheduleRun({ block })
        continue
      }

      const targetBlock = resolveCodeBlockFromNode(mutation.target, root)
      if (targetBlock && !isPrismTokenNode(mutation.target)) {
        hasRelevantMutation = true
        scheduleRun({ block: targetBlock })
      }

      for (const node of Array.from(mutation.addedNodes)) {
        if (isPrismTokenNode(node)) continue
        const addedBlock = resolveCodeBlockFromNode(node, root)
        if (!addedBlock) continue
        hasRelevantMutation = true
        scheduleRun({ block: addedBlock })
      }

      if (shouldRescanPrismOnRemovedNodes(mutation.removedNodes)) {
        hasRelevantMutation = true
        scheduleRun({ fullRescan: true })
      }
    }

    return hasRelevantMutation
  }

  return {
    requestFullRescan,
    queueBlock,
    collectTargetBlocks,
    hasCodeBlockMissingLineWrappers,
    highlightCodeBlocks,
    handleMutationRecords,
  }
}
