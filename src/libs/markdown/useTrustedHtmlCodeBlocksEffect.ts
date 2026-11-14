// 참조 구현: Starlight Code frame / Expressive Code 패턴 (https://github.com/withastro/starlight, MIT License, Copyright (c) 2023 Astro Contributors)
// `trustedContentHtml` 경로의 <pre><code> 블록을 `.aq-code-block` 툴바·복사·접기 프레임으로 점진 보강한다.

import { useEffect, type RefObject } from "react"
import type { TranslationKey } from "src/libs/language"
import { toLanguageLabel } from "src/libs/markdown/rendering"
import {
  COLLAPSIBLE_CODE_LINE_THRESHOLD,
  countRawCodeLines,
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
  t: (key: TranslationKey) => string
) => {
  copyBtn.classList.toggle("is-copied", state === "copied")
  copyBtn.classList.toggle("is-failed", state === "failed")
  if (state === "copied") {
    copyBtn.setAttribute("aria-label", t("codeCopiedAria"))
    copyBtn.setAttribute("title", t("codeCopied"))
    copyBtn.textContent = t("codeCopiedButton")
    return
  }
  if (state === "failed") {
    copyBtn.setAttribute("aria-label", t("codeCopyFailedAria"))
    copyBtn.setAttribute("title", t("codeCopyFailed"))
    copyBtn.textContent = t("codeCopyFailedButton")
    return
  }
  copyBtn.setAttribute("aria-label", t("codeCopyAria"))
  copyBtn.setAttribute("title", t("codeCopy"))
  copyBtn.textContent = t("codeCopyButton")
}

const wrapTrustedPreElement = (pre: HTMLPreElement, t: (key: TranslationKey) => string) => {
  if (
    pre.classList.contains("aq-mermaid") ||
    pre.dataset.aqMermaid === "true" ||
    pre.closest(".aq-code-block")
  ) {
    return
  }
  const code = pre.querySelector("code")
  if (!code || code.classList.contains("language-mermaid")) return

  const rawCode =
    code.getAttribute("data-raw-code") ??
    code.getAttribute("data-prism-source") ??
    code.textContent ??
    ""
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

  const block = document.createElement("div")
  block.className = "aq-code-block"
  block.dataset.aqEnhanced = "true"
  block.dataset.lineCount = String(lineCount)
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
  titleSpan.textContent = title.trim() || toLanguageLabel(language)

  const copyBtn = document.createElement("button")
  copyBtn.type = "button"
  copyBtn.className = "aq-code-copy"
  syncCopyButtonLabel(copyBtn, "idle", t)
  toolbar.append(titleSpan, copyBtn)

  const body = document.createElement("div")
  body.className = "aq-code-body"
  const shell = document.createElement("div")
  shell.className = "aq-code-shell"

  pre.classList.add("aq-code", "aq-pretty-pre")
  if (!code.getAttribute("data-raw-code")) {
    code.setAttribute("data-raw-code", rawCode)
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
  t: (key: TranslationKey) => string
) => {
  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root) return

    for (const pre of root.querySelectorAll<HTMLPreElement>("pre")) {
      wrapTrustedPreElement(pre, t)
    }

    for (const block of root.querySelectorAll<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')) {
      const copyBtn = block.querySelector<HTMLButtonElement>(".aq-code-copy")
      if (copyBtn && !copyBtn.classList.contains("is-copied") && !copyBtn.classList.contains("is-failed")) {
        syncCopyButtonLabel(copyBtn, "idle", t)
      }
      const toggleBtn = block.querySelector<HTMLButtonElement>(".aq-code-collapse-toggle")
      const lineCount = Number.parseInt(block.dataset.lineCount || "0", 10)
      if (toggleBtn && Number.isFinite(lineCount) && lineCount > 0) {
        syncCollapseButtonLabel(toggleBtn, block.dataset.collapsed === "true", lineCount, t)
      }
    }

    const activeTimers = new Map<HTMLButtonElement, number>()

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const copyBtn = target.closest<HTMLButtonElement>(".aq-code-copy")
      if (copyBtn) {
        const block = copyBtn.closest<HTMLElement>('.aq-code-block[data-aq-enhanced="true"]')
        if (!block) return
        const code = block.querySelector("code")
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
            syncCopyButtonLabel(copyBtn, "idle", t)
          }, 1400)
          activeTimers.set(copyBtn, timer)
        }
        Promise.resolve(navigator.clipboard?.writeText?.(rawCode))
          .then(() => {
            syncCopyButtonLabel(copyBtn, "copied", t)
            scheduleReset()
          })
          .catch(() => {
            syncCopyButtonLabel(copyBtn, "failed", t)
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
      }
    }

    root.addEventListener("click", handleClick)
    return () => {
      root.removeEventListener("click", handleClick)
      for (const timer of activeTimers.values()) {
        window.clearTimeout(timer)
      }
      activeTimers.clear()
    }
  }, [enabled, renderKey, rootRef, t])
}
