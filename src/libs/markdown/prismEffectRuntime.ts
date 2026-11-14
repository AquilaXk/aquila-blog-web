import {
  inferPrismLanguageFromSource,
  highlightCodeToHtml,
  renderImmediateCodeToHtml,
} from "src/libs/markdown/prismRuntime"
import { parseHighlightedLineNumbers } from "src/libs/markdown/renderingCodeModel"

export const PRISM_DEFAULT_MUTATION_DEBOUNCE_MS = 72
export const PRISM_INITIAL_HYDRATION_TIMEOUT_MS = 1200

type PrismScheduleRun = (options?: { fullRescan?: boolean; block?: HTMLElement }) => void

const extractLanguageFromClassList = (block: HTMLElement) => {
  const { classList } = block
  for (let i = 0; i < classList.length; i += 1) {
    const className = classList[i]
    if (className && className.startsWith("language-")) {
      return className.replace("language-", "").trim().toLowerCase()
    }
  }
  return ""
}

const replaceBlockLanguageClass = (block: HTMLElement, nextLanguage: string) => {
  const { classList } = block
  for (let i = classList.length - 1; i >= 0; i -= 1) {
    const className = classList[i]
    if (className && className.startsWith("language-")) {
      classList.remove(className)
    }
  }
  classList.add(`language-${nextLanguage}`)
}

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

const isRemovedElementRequiringPrismRescan = (element: Element): boolean => {
  if (isMermaidCodeBlock(element)) return false
  if (element.matches("code")) return true
  if (element.matches("pre")) {
    const codeChildren = Array.from(element.querySelectorAll("code"))
    return codeChildren.length === 0 || codeChildren.some((child) => !isMermaidCodeBlock(child))
  }
  const nestedCodeBlocks = Array.from(element.querySelectorAll("pre > code"))
  return nestedCodeBlocks.some((child) => !isMermaidCodeBlock(child))
}

export const shouldRescanPrismOnRemovedNodes = (removedNodes: Iterable<Node>): boolean => {
  for (const node of removedNodes) {
    if (!node || typeof (node as Element).matches !== "function") continue
    if (isRemovedElementRequiringPrismRescan(node as Element)) return true
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

  const hasCodeBlockMissingLineWrappers = () => {
    const blocks = root.querySelectorAll<HTMLElement>("pre > code")
    for (const block of blocks) {
      if (!isMermaidCodeBlock(block) && !block.querySelector("[data-line]")) {
        return true
      }
    }
    return false
  }

  const highlightCodeBlocks = async (codeBlocks: HTMLElement[]) => {
    if (!codeBlocks.length) return

    const languageByBlock: Array<{
      block: HTMLElement
      language: string
      source: string
    }> = []

    for (let i = 0; i < codeBlocks.length; i += 1) {
      const block = codeBlocks[i]
      const rawLanguage = extractLanguage(block)
      const source = extractCodeSource(block)
      const inferred = isGenericLanguage(rawLanguage)
        ? inferPrismLanguageFromSource(source)
        : rawLanguage
      const hasSyntaxMarkup = blockHasSyntaxMarkup(block)
      const hasLineWrappers = Boolean(block.querySelector("[data-line]"))
      const shouldHighlight =
        inferred.length > 0 &&
        inferred !== "mermaid" &&
        (!hasSyntaxMarkup || !hasLineWrappers)
      const alreadyHighlighted =
        block.dataset.prismLanguage === inferred &&
        block.dataset.prismSource === source &&
        hasLineWrappers

      if (shouldHighlight && !alreadyHighlighted) {
        languageByBlock.push({ block, language: inferred, source })
      }
    }

    if (!languageByBlock.length) return

    const asyncCandidates: Array<{
      block: HTMLElement
      language: string
      source: string
      highlightedLines: Set<number>
    }> = []

    for (const { block, language, source } of languageByBlock) {
      const highlightSpec = block.dataset.highlightLines || ""
      const highlightedLines = parseHighlightedLineNumbers(highlightSpec)
      const immediate = renderImmediateCodeToHtml({
        source,
        language,
        highlightedLines,
      })
      const cleanSource = immediate.cleanSource
      replaceBlockLanguageClass(block, immediate.language)
      block.innerHTML = ensureLineWrappedHtml({
        html: immediate.html,
        language: immediate.language,
        source: cleanSource,
        highlightedLines,
      })
      block.dataset.prismLanguage = immediate.language
      block.dataset.prismSource = cleanSource
      block.dataset.language = immediate.language
      block.dataset.rawCode = cleanSource
      if (immediate.hasDiff) {
        block.dataset.hasDiff = "true"
      } else {
        delete block.dataset.hasDiff
      }
      if (immediate.highlighted) {
        block.dataset.prismHighlighted = "true"
        continue
      }
      asyncCandidates.push({
        block,
        language,
        source: cleanSource,
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

    for (let index = 0; index < highlightedBlocks.length; index += 1) {
      const { block, highlightedLines, result } = highlightedBlocks[index]
      if (!block.isConnected || !root.contains(block)) continue
      const language = result.language
      const cleanSource = result.cleanSource
      replaceBlockLanguageClass(block, language)
      block.innerHTML = ensureLineWrappedHtml({
        html: result.html,
        language,
        source: cleanSource,
        highlightedLines,
      })
      block.dataset.prismLanguage = language
      block.dataset.prismSource = cleanSource
      block.dataset.language = language
      block.dataset.rawCode = cleanSource
      if (result.hasDiff) {
        block.dataset.hasDiff = "true"
      } else {
        delete block.dataset.hasDiff
      }
      if (result.highlighted) {
        block.dataset.prismHighlighted = "true"
      }
    }
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
