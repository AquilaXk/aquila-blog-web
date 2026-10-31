export type MockDomEvent = Record<string, unknown>

const toDatasetCamel = (name: string) =>
  name.slice(5).replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())

export class SimpleDomElement {
  tagName: string
  className = ""
  private rawTextContent = ""
  value = ""
  type = ""
  src = ""
  alt = ""
  href = ""
  target = ""
  rel = ""
  loading = ""
  tabIndex = 0
  disabled = false
  scrollLeft = 0
  selectionStart: number | null = 0
  selectionEnd: number | null = 0
  isConnected = true
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: SimpleDomElement[] = []
  parentElement: SimpleDomElement | null = null
  listeners = new Map<string, Array<(event: MockDomEvent) => void>>()
  private innerHtmlValue = ""
  classList = {
    add: (...tokens: string[]) => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean))
      for (const token of tokens) set.add(token)
      this.className = [...set].join(" ")
    },
    remove: (...tokens: string[]) => {
      const removeSet = new Set(tokens)
      this.className = this.className
        .split(/\s+/)
        .filter((token) => Boolean(token) && !removeSet.has(token))
        .join(" ")
    },
    contains: (token: string) => this.className.split(/\s+/).includes(token),
    toggle: (token: string, force?: boolean) => {
      const has = this.className.split(/\s+/).includes(token)
      const next = force ?? !has
      if (next) this.classList.add(token)
      else this.classList.remove(token)
      return next
    },
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  get textContent(): string {
    return this.children.length > 0
      ? this.children.map((child) => child.textContent).join("")
      : this.rawTextContent
  }

  set textContent(val: string) {
    this.rawTextContent = val
    this.children = []
  }

  get innerHTML() {
    return this.innerHtmlValue
  }

  set innerHTML(val: string) {
    this.innerHtmlValue = val
    if (val === "") {
      this.children = []
      this.rawTextContent = ""
    }
  }

  setAttribute(name: string, val: string) {
    if (name === "href") this.href = val
    if (name.startsWith("data-")) {
      this.dataset[toDatasetCamel(name)] = val
      return
    }
    this.attributes.set(name, val)
  }

  getAttribute(name: string) {
    if (name.startsWith("data-")) return this.dataset[toDatasetCamel(name)] ?? null
    return this.attributes.get(name) ?? null
  }

  removeAttribute(name: string) {
    if (name === "href") this.href = ""
    this.attributes.delete(name)
    if (name.startsWith("data-")) delete this.dataset[toDatasetCamel(name)]
  }

  appendChild<T extends SimpleDomElement>(child: T): T {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  append(...nodes: SimpleDomElement[]) {
    for (const node of nodes) this.appendChild(node)
  }

  contains(other: unknown): boolean {
    let cur = other as SimpleDomElement | null
    while (cur) {
      if (cur === this) return true
      cur = cur.parentElement
    }
    return false
  }

  closest(selector: string): SimpleDomElement | null {
    let cur: SimpleDomElement | null = this
    while (cur) {
      if (cur.matchesSelector(selector)) return cur
      cur = cur.parentElement
    }
    return null
  }

  private matchesSelector(selector: string): boolean {
    if (selector === ".cm-live-table-wrap[data-active-mode]") {
      return this.classList.contains("cm-live-table-wrap") && Boolean(this.dataset.activeMode)
    }
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1))
    if (selector.startsWith('[data-testid="') && selector.endsWith('"]')) {
      return this.getAttribute("data-testid") === selector.slice(14, -2)
    }
    if (selector === "[data-table-popover]") return this.getAttribute("data-table-popover") !== null
    return this.tagName.toLowerCase() === selector.toLowerCase()
  }

  querySelector(selector: string): SimpleDomElement | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child
      const nested = child.querySelector(selector)
      if (nested) return nested
    }
    return null
  }

  querySelectorAll(selector: string): SimpleDomElement[] {
    const out: SimpleDomElement[] = []
    for (const child of this.children) {
      if (child.matchesSelector(selector)) out.push(child)
      out.push(...child.querySelectorAll(selector))
    }
    return out
  }

  addEventListener(type: string, fn: (event: MockDomEvent) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, fn: (event: MockDomEvent) => void) {
    const list = this.listeners.get(type)
    if (list) this.listeners.set(type, list.filter((entry) => entry !== fn))
  }

  dispatch(type: string, init: Record<string, unknown> = {}) {
    let defaultPrevented = false
    let propagationStopped = false
    const event: MockDomEvent = {
      type,
      target: init.target ?? this,
      currentTarget: this,
      button: 0,
      preventDefault() {
        defaultPrevented = true
      },
      stopPropagation() {
        propagationStopped = true
      },
      get defaultPrevented() {
        return defaultPrevented
      },
      ...init,
    }
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event)
      if (propagationStopped) break
    }
    return event
  }

  focus() {
    const doc = (globalThis as { document?: { activeElement?: unknown } }).document
    if (doc) doc.activeElement = this
  }

  blur() {
    const doc = (globalThis as { document?: { activeElement?: unknown } }).document
    if (doc && doc.activeElement === this) doc.activeElement = null
    this.dispatch("blur")
  }

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start
    this.selectionEnd = end
  }

  getBoundingClientRect() {
    return { width: 120, height: 32, top: 0, left: 0, right: 120, bottom: 32 }
  }
}

export const withMockDom = <T>(
  fn: (
    winListeners: Map<string, Array<(e: MockDomEvent) => void>>,
    docElement: SimpleDomElement
  ) => T
): T => {
  const globalRecord = globalThis as Record<string, unknown>
  const prevDoc = globalRecord.document
  const prevWin = globalRecord.window
  const winListeners = new Map<string, Array<(e: MockDomEvent) => void>>()
  const docElement = new SimpleDomElement("html")
  globalRecord.document = {
    documentElement: docElement,
    createElement: (tag: string) => new SimpleDomElement(tag),
    createTextNode: (text: string) => {
      const node = new SimpleDomElement("#text")
      node.textContent = text
      return node
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    activeElement: null,
  }
  globalRecord.window = {
    innerWidth: 1280,
    innerHeight: 840,
    addEventListener: (type: string, cb: (e: MockDomEvent) => void) => {
      const list = winListeners.get(type) ?? []
      list.push(cb)
      winListeners.set(type, list)
    },
    removeEventListener: (type: string, cb: (e: MockDomEvent) => void) => {
      const list = winListeners.get(type)
      if (list) winListeners.set(type, list.filter((entry) => entry !== cb))
    },
  }
  const restore = () => {
    globalRecord.document = prevDoc
    globalRecord.window = prevWin
  }
  try {
    const result = fn(winListeners, docElement)
    if (result instanceof Promise) {
      return result.finally(restore) as T
    }
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}
