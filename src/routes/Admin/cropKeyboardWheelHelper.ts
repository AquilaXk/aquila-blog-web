// 참조 구현: ValentinH/react-easy-crop (MIT) & fengyuanchen/cropperjs (MIT) — 크롭 마우스 휠 줌 및 키보드 조작 헬퍼
import type { WheelEvent as ReactWheelEvent, KeyboardEvent as ReactKeyboardEvent } from "react"
import { PROFILE_IMAGE_EDIT_MAX_ZOOM, PROFILE_IMAGE_EDIT_MIN_ZOOM } from "src/libs/profileImageUpload"

export const clampZoom = (zoom: number): number =>
  Math.min(PROFILE_IMAGE_EDIT_MAX_ZOOM, Math.max(PROFILE_IMAGE_EDIT_MIN_ZOOM, zoom))

export const computeNextWheelZoom = (currentZoom: number, deltaY: number): number => {
  const step = deltaY < 0 ? 0.05 : -0.05
  return clampZoom(Number((currentZoom + step).toFixed(2)))
}

export type KeyboardMoveOffset = {
  deltaX: number
  deltaY: number
}

export const computeKeyboardMove = (
  key: string,
  shiftKey: boolean
): KeyboardMoveOffset | null => {
  const step = shiftKey ? 50 : 10
  switch (key) {
    case "ArrowLeft":
      return { deltaX: -step, deltaY: 0 }
    case "ArrowRight":
      return { deltaX: step, deltaY: 0 }
    case "ArrowUp":
      return { deltaX: 0, deltaY: -step }
    case "ArrowDown":
      return { deltaX: 0, deltaY: step }
    default:
      return null
  }
}

export const handleCropWheel = (
  event: ReactWheelEvent<HTMLElement>,
  currentZoom: number,
  onZoomChange: (zoom: number) => void
) => {
  event.preventDefault()
  const next = computeNextWheelZoom(currentZoom, event.deltaY)
  if (next !== currentZoom) {
    onZoomChange(next)
  }
}

export const handleCropKeyDown = (
  event: ReactKeyboardEvent<HTMLElement>,
  currentZoom: number,
  onZoomChange: (zoom: number) => void,
  onMoveOffset?: (offset: KeyboardMoveOffset) => void
): boolean => {
  // 줌 단축키: + / = (확대), - (축소), 0 (1.0 리셋)
  if (event.key === "+" || event.key === "=") {
    event.preventDefault()
    onZoomChange(clampZoom(Number((currentZoom + 0.1).toFixed(2))))
    return true
  }
  if (event.key === "-") {
    event.preventDefault()
    onZoomChange(clampZoom(Number((currentZoom - 0.1).toFixed(2))))
    return true
  }
  if (event.key === "0") {
    event.preventDefault()
    onZoomChange(1.0)
    return true
  }

  // 방향키 이동
  const move = computeKeyboardMove(event.key, event.shiftKey)
  if (move && onMoveOffset) {
    event.preventDefault()
    onMoveOffset(move)
    return true
  }

  return false
}
