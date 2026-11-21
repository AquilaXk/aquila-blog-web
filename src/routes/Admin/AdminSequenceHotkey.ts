// 참조 구현: github/hotkey (MIT) — 2-키 시퀀스 핫키 상태 머신 및 포커스 판별 헬퍼
const SEQUENCE_TIMEOUT_MS = 900

const SEQUENCE_MAP: Record<string, string> = {
  h: "/admin",
  d: "/admin/dashboard",
  p: "/admin/posts",
  n: "/admin/editor/new",
  c: "/admin/cloud",
  u: "/admin/profile",
  t: "/admin/tools",
}

export const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== "object") return false
  if (typeof HTMLElement !== "undefined" && !(target instanceof HTMLElement)) return false
  const el = target as { tagName?: string; isContentEditable?: boolean; getAttribute?: (name: string) => string | null }
  const tag = el.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(el.isContentEditable) ||
    el.getAttribute?.("role") === "textbox"
  )
}

export class SequenceHotkeyStateMachine {
  private pendingG = false
  private timer: ReturnType<typeof setTimeout> | null = null

  public handleKeyDown(
    event: KeyboardEvent,
    navigate: (url: string) => void,
    isDialogActive = false
  ): boolean {
    if (isDialogActive) {
      this.reset()
      return false
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      this.reset()
      return false
    }
    if (event.isComposing || event.keyCode === 229) {
      return false
    }
    if (isEditableElement(event.target)) {
      this.reset()
      return false
    }

    const key = event.key.toLowerCase()

    if (!this.pendingG) {
      if (key === "g") {
        this.pendingG = true
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => this.reset(), SEQUENCE_TIMEOUT_MS)
        return true
      }
      return false
    }

    // pendingG === true
    this.reset()
    const targetUrl = SEQUENCE_MAP[key]
    if (targetUrl) {
      event.preventDefault()
      navigate(targetUrl)
      return true
    }
    return false
  }

  public reset(): void {
    this.pendingG = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  public isPending(): boolean {
    return this.pendingG
  }
}
