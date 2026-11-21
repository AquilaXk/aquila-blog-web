// 참조 구현: payloadcms/payload (MIT) & meta/docusaurus (MIT) — WAI-ARIA 탭리스트 키보드 탐색 핸들러
import type { KeyboardEvent as ReactKeyboardEvent } from "react"

export const handleTablistKeyDown = <T extends string>(
  event: ReactKeyboardEvent<HTMLElement>,
  tabs: readonly T[],
  activeTab: T | null,
  onSelectTab: (tab: T) => void
): void => {
  if (tabs.length === 0) return

  const currentIndex = activeTab ? tabs.indexOf(activeTab) : 0
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0

  let nextIndex: number | null = null

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (safeCurrentIndex + 1) % tabs.length
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (safeCurrentIndex - 1 + tabs.length) % tabs.length
  } else if (event.key === "Home") {
    nextIndex = 0
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1
  }

  if (nextIndex !== null) {
    event.preventDefault()
    const nextTab = tabs[nextIndex]!
    onSelectTab(nextTab)
    // 탭 버튼으로 포커스 이동
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons[nextIndex]?.focus()
  }
}
