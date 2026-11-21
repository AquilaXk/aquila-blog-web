// 참조 구현: Starlight Code frame / Expressive Code 패턴 (https://github.com/withastro/starlight, MIT License, Copyright (c) 2023 Astro Contributors) & Docusaurus (`facebook/docusaurus`, `useCodeWordWrap.ts`, `WordWrapButton`, `CopyButton`, MIT License, Copyright (c) Meta Platforms, Inc. and affiliates.)
// `trustedContentHtml` 경로의 <pre><code> 블록을 `.aq-code-block` 툴바·복사·접기 프레임으로 점진 보강한다.

import { useEffect, type RefObject } from "react"
import type { SiteLanguage, TranslationKey } from "src/libs/language"
import { toLanguageLabel } from "src/libs/markdown/rendering"
import { extractCodeLineAnnotations } from "src/libs/markdown/prismRuntime"
import {
  CODE_COPY_STACK_ICONS_HTML,
  CODE_WORD_WRAP_ICON_SVG,
  COLLAPSIBLE_CODE_LINE_THRESHOLD,
  copyTextToClipboard,
  countRawCodeLines,
  getCodeBlockExtraLabels,
  isCodeShellHorizontallyScrollable,
  resolveCodeGutterWidth,
} from "src/libs/markdown/components/PrettyCodeBlock"

const extractPreLanguage = (pre: HTMLElement, code: Element): string => {
  const explicitLang =
    code.getAttribute("data-language") ||
    code.getAttribute("data-prism-language") ||
    pre.getAttribute("data-language") ||
    ""
  if (explicitLang.trim()) return explicitLang.trim()
  const classText = `${code.getAttribute("class") || ""} ${pre.getAttribute("class") || ""}`
  const match = /\blanguage-([A-Za-z0-9_-]+)/.exec(classText)
  return match?.[1] ?? ""
}

const syncCollapseButtonLabel = (
  toggleBtn: HTMLButtonElement,
  isCollapsed: boolean,
  lineCount: number,
  t: (key: TranslationKey) => string
) => {
  toggleBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
  toggleBtn.textContent = isCollapsed
    ? `${t("codeExpandPrefix")} (${lineCount}${t("codeLinesUnit")})`
    : t("codeCollapse")
}

const syncCopyButtonLabel = (
  copyBtn: HTMLButtonElement,
  state: "idle" | "copied" | "failed",
  t: (key: TranslationKey) => string,
  extraLabels: ReturnType<typeof getCodeBlockExtraLabels>
) => {
  copyBtn.classList.toggle("is-copied", state === "copied")
  copyBtn.classList.toggle("is-failed", state === "failed")
  if (!copyBtn.querySelector?.(".aq-code-copy-icons")) {
    copyBtn.innerHTML = CODE_COPY_STACK_ICONS_HTML
  }
  if (state === "copied") {
    copyBtn.setAttribute("aria-label", t("codeCopiedAria"))
    copyBtn.setAttribute("title", t("codeCopied"))
    return
  }
  if (state === "failed") {
    copyBtn.setAttribute("aria-label", extraLabels.copyFailedAria)
    copyBtn.setAttribute("title", extraLabels.copyFailed)
    return
  }
  copyBtn.setAttribute("aria-label", t("codeCopyAria"))
  copyBtn.setAttribute("title", t("codeCopy"))
}

export const syncTrustedCodeBlockScrollableAttr = (block: HTMLElement) => {
  if (block.dataset.wrap === "true") {
    block.dataset.scrollable = "true"
    return
  }
  const shell = block.querySelector<HTMLElement>(".aq-code-shell")
  block.dataset.scrollable = isCodeShellHorizontallyScrollable(shell) ? "true" : "false"
}

const wrapTrustedPreElement = (
  pre: HTMLPreElement,
  t: (key: TranslationKey) => string,
  extraLabels: ReturnType<typeof getCodeBlockExtraLabels>
) => {
  if (
    pre.classList.contains("aq-mermaid") ||
    pre.dataset.aqMermaid === "true" ||
    pre.closest(".aq-code-block")
  ) {
    return
  }
  const code = pre.querySelector("code")
  if (!code || code.classList.contains("language-mermaid")) return

  const rawSource =
    code.getAttribute("data-raw-code") ??
    code.getAttribute("data-prism-source") ??
    code.textContent ??
    ""
  const annotations = extractCodeLineAnnotations(rawSource)
  const rawCode = annotations.cleanSource
  const language = extractPreLanguage(pre, code)
  const title =
    pre.getAttribute("data-title") ||
    code.getAttribute("data-title") ||
    pre.getAttribute("title") ||
    ""
  const highlightLines =
    code.getAttribute("data-highlight-lines") || pre.getAttribute("data-highlight-lines") || ""

  const lineCount = countRawCodeLines(rawCode)
  const isCollapsible = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
  const languageLabel = toLanguageLabel(language)
  const trimmedTitle = title.trim()
  const hasExplicitTitle =
    trimmedTitle.length > 0 && trimmedTitle.toLowerCase() !== languageLabel.toLowerCase()
  const primaryTitle = hasExplicitTitle ? trimmedTitle : languageLabel

  const block = document.createElement("div")
  block.className = "aq-code-block"
  block.dataset.aqEnhanced = "true"
  block.dataset.lineCount = String(lineCount)
  block.dataset.wrap = "false"
  block.dataset.scrollable = "false"
  block.style.setProperty("--aq-code-gutter-width", resolveCodeGutterWidth(lineCount))
  if (isCollapsible) {
    block.dataset.collapsed = "true"
  }
  if (highlightLines) {
    block.dataset.highlightLines = highlightLines
  }

  const toolbar = document.createElement("div")
  toolbar.className = "aq-code-toolbar"
  const titleSpan = document.createElement("span")
  titleSpan.className = "aq-code-title"
  titleSpan.textContent = primaryTitle

  const actions = document.createElement("div")
  actions.className = "aq-code-actions"
  if (hasExplicitTitle && languageLabel) {
    const langBadge = document.createElement("span")
    langBadge.className = "aq-code-lang"
    langBadge.textContent = languageLabel
    actions.appendChild(langBadge)
  }

  const wrapBtn = document.createElement("button")
  wrapBtn.type = "button"
  wrapBtn.className = "aq-code-wrap"
  wrapBtn.setAttribute("aria-pressed", "false")
  wrapBtn.setAttribute("aria-label", extraLabels.wrapAria)
  wrapBtn.setAttribute("title", extraLabels.wrapLabel)
  wrapBtn.innerHTML = CODE_WORD_WRAP_ICON_SVG

  const copyBtn = document.createElement("button")
  copyBtn.type = "button"
  copyBtn.className = "aq-code-copy"
  copyBtn.innerHTML = CODE_COPY_STACK_ICONS_HTML
  syncCopyButtonLabel(copyBtn, "idle", t, extraLabels)

  const liveStatus = document.createElement("span")
  liveStatus.className = "aq-code-live aq-sr-only"
  liveStatus.setAttribute("aria-live", "polite")

  actions.append(wrapBtn, copyBtn)
  toolbar.append(titleSpan, actions, liveStatus)

  const body = document.createElement("div")
  body.className = "aq-code-body"
  const shell = document.createElement("div")
  shell.className = "aq-code-shell"
  shell.tabIndex = 0
  shell.setAttribute("role", "region")
  shell.setAttribute("aria-label", primaryTitle || "코드 영역")

  pre.classList.add("aq-code", "aq-pretty-pre")
  code.setAttribute("data-raw-code", rawCode)
  if (annotations.hasAnnotations && !code.getAttribute("data-prism-source")) {
    code.setAttribute("data-prism-source", rawSource)
  }

  const parent = pre.parentNode
  if (!parent) return
  parent.insertBefore(block, pre)
  shell.appendChild(pre)
  body.appendChild(shell)
  block.append(toolbar, body)

  if (isCollapsible) {
    const toggleBtn = document.createElement("button")
    toggleBtn.type = "button"
    toggleBtn.className = "aq-code-collapse-toggle"
    syncCollapseButtonLabel(toggleBtn, true, lineCount, t)
    block.appendChild(toggleBtn)
  }
}

export const useTrustedHtmlCodeBlocksEffect = (
  rootRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  renderKey: string,
  t: (key: TranslationKey) => string,
  language: SiteLanguage = "ko"
) => {
  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root) return
    const extraLabels = getCodeBlockExtraLabels(language)

    for (const pre of root.querySelectorAll<HTMLPreElement>("pre")) {
      wrapTrustedPreElement(pre, t, extraLabels)
    }

    const enhancedBlocks = Array.from(
      root.querySelectorAll<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')
    )
    const shellToBlock = new Map<Element, HTMLElement>()
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              const ownerBlock = shellToBlock.get(entry.target)
              if (ownerBlock) {
                syncTrustedCodeBlockScrollableAttr(ownerBlock)
              }
            }
          })
        : null

    for (const block of enhancedBlocks) {
      const copyBtn = block.querySelector<HTMLButtonElement>(".aq-code-copy")
      if (copyBtn && !copyBtn.classList.contains("is-copied") && !copyBtn.classList.contains("is-failed")) {
        syncCopyButtonLabel(copyBtn, "idle", t, extraLabels)
      }
      const wrapBtn = block.querySelector<HTMLButtonElement>(".aq-code-wrap")
      if (wrapBtn) {
        wrapBtn.setAttribute("aria-label", extraLabels.wrapAria)
        wrapBtn.setAttribute("title", extraLabels.wrapLabel)
        if (!wrapBtn.querySelector("svg")) {
          wrapBtn.innerHTML = CODE_WORD_WRAP_ICON_SVG
        }
      }
      const toggleBtn = block.querySelector<HTMLButtonElement>(".aq-code-collapse-toggle")
      const lineCount = Number.parseInt(block.dataset.lineCount || "0", 10)
      if (toggleBtn && Number.isFinite(lineCount) && lineCount > 0) {
        syncCollapseButtonLabel(toggleBtn, block.dataset.collapsed === "true", lineCount, t)
      }
      syncTrustedCodeBlockScrollableAttr(block)
      const shell = block.querySelector<HTMLElement>(".aq-code-shell")
      if (shell && resizeObserver) {
        shellToBlock.set(shell, block)
        resizeObserver.observe(shell)
        const pre = shell.querySelector("pre")
        if (pre) {
          shellToBlock.set(pre, block)
          resizeObserver.observe(pre)
        }
      }
    }

    const handleWindowResize = () => {
      for (const block of enhancedBlocks) {
        syncTrustedCodeBlockScrollableAttr(block)
      }
    }
    if (!resizeObserver) {
      window.addEventListener("resize", handleWindowResize, { passive: true })
    }

    const activeTimers = new Map<HTMLButtonElement, number>()

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const wrapBtn = target.closest<HTMLButtonElement>(".aq-code-wrap")
      if (wrapBtn) {
        const block = wrapBtn.closest<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')
        if (!block) return
        const nextWrapped = block.dataset.wrap !== "true"
        block.dataset.wrap = nextWrapped ? "true" : "false"
        wrapBtn.setAttribute("aria-pressed", nextWrapped ? "true" : "false")
        syncTrustedCodeBlockScrollableAttr(block)
        return
      }

      const copyBtn = target.closest<HTMLButtonElement>(".aq-code-copy")
      if (copyBtn) {
        const block = copyBtn.closest<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')
        if (!block) return
        const code = block.querySelector("code")
        const liveStatus = block.querySelector<HTMLElement>(".aq-code-live")
        const rawCode =
          code?.getAttribute("data-raw-code") ??
          code?.getAttribute("data-prism-source") ??
          code?.textContent ??
          ""
        const scheduleReset = () => {
          const prevTimer = activeTimers.get(copyBtn)
          if (prevTimer !== undefined) window.clearTimeout(prevTimer)
          const timer = window.setTimeout(() => {
            activeTimers.delete(copyBtn)
            syncCopyButtonLabel(copyBtn, "idle", t, extraLabels)
            if (liveStatus) liveStatus.textContent = ""
          }, 1400)
          activeTimers.set(copyBtn, timer)
        }
        void copyTextToClipboard(rawCode).then((ok) => {
          syncCopyButtonLabel(copyBtn, ok ? "copied" : "failed", t, extraLabels)
          if (liveStatus) {
            liveStatus.textContent = ok ? t("codeCopied") : extraLabels.copyFailed
          }
          scheduleReset()
        })
        return
      }

      const toggleBtn = target.closest<HTMLButtonElement>(".aq-code-collapse-toggle")
      if (toggleBtn) {
        const block = toggleBtn.closest<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')
        if (!block) return
        const nextCollapsed = block.dataset.collapsed !== "true"
        block.dataset.collapsed = nextCollapsed ? "true" : "false"
        const lineCount = Number.parseInt(block.dataset.lineCount || "0", 10)
        syncCollapseButtonLabel(toggleBtn, nextCollapsed, lineCount, t)
        syncTrustedCodeBlockScrollableAttr(block)
      }
    }

    root.addEventListener("click", handleClick)
    return () => {
      root.removeEventListener("click", handleClick)
      resizeObserver?.disconnect()
      if (!resizeObserver) {
        window.removeEventListener("resize", handleWindowResize)
      }
      for (const timer of activeTimers.values()) {
        window.clearTimeout(timer)
      }
      activeTimers.clear()
    }
  }, [enabled, language, renderKey, rootRef, t])
}
