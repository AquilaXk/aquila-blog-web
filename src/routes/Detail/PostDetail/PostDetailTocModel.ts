import {
  createMarkdownDocumentInsights,
  createMarkdownHeadingSlugAllocator,
  type MarkdownDocumentHeading,
} from "../../../libs/markdown/markdownDocumentInsights"

export type TocItem = {
  id: string
  text: string
  level: 2 | 3 | 4
}

export const buildInitialTocFromMarkdown = (
  markdown: string,
  precomputedHeadings?: readonly MarkdownDocumentHeading[]
): TocItem[] => {
  if (!markdown.trim()) return []
  const headings = precomputedHeadings ?? createMarkdownDocumentInsights(markdown).headings
  return headings
    .filter((heading): heading is typeof heading & { level: 2 | 3 | 4 } => heading.level >= 2)
    .map(({ id, slug, label, level }) => ({
      id: id || slug,
      text: label,
      level,
    }))
}

const TOC_SELECTOR = ".aq-markdown h2, .aq-markdown h3, .aq-markdown h4"
const TOC_MUTATION_HEADING_SELECTOR = "h1, h2, h3, h4"
const TOC_MUTATION_IGNORED_SELECTOR = ".aq-mermaid, .aq-code-block, svg"

const resolveMutationElement = (node: Node | null | undefined): Element | null => {
  if (!node) return null
  if (typeof (node as Element).matches === "function") return node as Element
  return node.parentElement ?? null
}

const isIgnoredTocMutationElement = (element: Element): boolean => {
  if (typeof SVGElement !== "undefined" && element instanceof SVGElement) return true
  if (element.tagName?.toLowerCase() === "svg") return true
  if (element.matches?.(TOC_MUTATION_IGNORED_SELECTOR)) return true
  return Boolean(element.closest?.(TOC_MUTATION_IGNORED_SELECTOR))
}

const nodeTouchesHeading = (node: Node | null | undefined, checkDescendants: boolean): boolean => {
  const element = resolveMutationElement(node)
  if (!element || isIgnoredTocMutationElement(element)) return false
  if (element.matches?.(TOC_MUTATION_HEADING_SELECTOR)) return true
  if (element.closest?.(TOC_MUTATION_HEADING_SELECTOR)) return true
  if (checkDescendants && element.querySelector?.(TOC_MUTATION_HEADING_SELECTOR)) return true
  return false
}

const nodeCollectionTouchesHeading = (nodes: Iterable<Node> | ArrayLike<Node> | null | undefined): boolean => {
  if (!nodes) return false
  if (typeof (nodes as ArrayLike<Node>).length === "number") {
    const list = nodes as ArrayLike<Node>
    for (let i = 0; i < list.length; i += 1) {
      if (nodeTouchesHeading(list[i], true)) return true
    }
    return false
  }
  for (const node of nodes as Iterable<Node>) {
    if (nodeTouchesHeading(node, true)) return true
  }
  return false
}

export const shouldSyncTocFromMutations = (mutations: Iterable<MutationRecord>): boolean => {
  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      if (nodeTouchesHeading(mutation.target, false)) return true
      continue
    }
    if (nodeTouchesHeading(mutation.target, false)) return true
    if (nodeCollectionTouchesHeading(mutation.addedNodes)) return true
    if (nodeCollectionTouchesHeading(mutation.removedNodes)) return true
  }
  return false
}

const normalizeHeadingText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/\u200B/g, "")
    .trim()

export const collectTocFromArticle = (article: HTMLElement): TocItem[] => {
  const headings = Array.from(article.querySelectorAll<HTMLElement>(TOC_SELECTOR))
  if (!headings.length) return []

  const slugAllocator = createMarkdownHeadingSlugAllocator()
  const toc: TocItem[] = []

  headings.forEach((heading) => {
    const text = normalizeHeadingText(heading.textContent || "")
    if (!text) return

    const level = Number(heading.tagName.replace("H", "")) as TocItem["level"]
    if (![2, 3, 4].includes(level)) return

    const id = slugAllocator.allocate(text, heading.id)
    if (heading.id !== id) heading.id = id

    toc.push({ id, text, level })
  })

  return toc
}

export const isSameToc = (left: TocItem[], right: TocItem[]) =>
  left.length === right.length &&
  left.every((item, index) => {
    const target = right[index]
    return target && item.id === target.id && item.text === target.text && item.level === target.level
  })

export const createRafScheduler = (callback: () => void) => {
  let rafId: number | null = null

  const schedule = () => {
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      callback()
    })
  }

  const cancel = () => {
    if (rafId === null) return
    window.cancelAnimationFrame(rafId)
    rafId = null
  }

  return { schedule, cancel }
}

export const createObserverRegistry = () => {
  const cleanups: Array<() => void> = []

  const add = (cleanup: () => void) => {
    cleanups.push(cleanup)
  }

  const addWindowEvent = (
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ) => {
    window.addEventListener(type, handler, options)
    add(() => window.removeEventListener(type, handler, options))
  }

  const addResizeObserver = (targets: HTMLElement[], callback: ResizeObserverCallback) => {
    if (!targets.length || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(callback)
    targets.forEach((target) => observer.observe(target))
    add(() => observer.disconnect())
  }

  const cleanup = () => {
    for (const clear of cleanups.splice(0, cleanups.length)) {
      clear()
    }
  }

  return {
    add,
    addWindowEvent,
    addResizeObserver,
    cleanup,
  }
}

export type HeadingOffset = {
  id: string
  topDoc: number
}

export const measureHeadingOffsets = (
  items: readonly TocItem[],
  scrollY: number = typeof window !== "undefined" ? window.scrollY : 0
): HeadingOffset[] => {
  if (typeof document === "undefined" || !items.length) return []
  const result: HeadingOffset[] = []
  for (const item of items) {
    const el = document.getElementById(item.id)
    if (el) {
      result.push({
        id: item.id,
        topDoc: scrollY + el.getBoundingClientRect().top,
      })
    }
  }
  return result
}

export const resolveActiveTocIdFromOffsets = (
  offsets: readonly HeadingOffset[],
  scrollY: number,
  boundaryOffset: number
): string => {
  if (!offsets.length) return ""
  const threshold = scrollY + boundaryOffset
  let lo = 0
  let hi = offsets.length - 1
  let activeId = offsets[0].id
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (offsets[mid].topDoc <= threshold) {
      activeId = offsets[mid].id
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return activeId
}
