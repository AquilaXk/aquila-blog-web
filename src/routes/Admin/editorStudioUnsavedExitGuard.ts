export const EDITOR_UNSAVED_CHANGES_MESSAGE =
  "저장되지 않은 변경이 있습니다. 이 페이지를 나가면 변경 내용이 사라질 수 있습니다."

export type EditorUnsavedDirtyFingerprintInput = {
  isSaving: boolean
  editorMode: "create" | "edit"
  hasSelectedManagedPost: boolean
  editorStateFingerprint: string
  serverBaselineFingerprint: string
  localDraftFingerprint: string
  localDraftSavedAt: string
  pristineCreateFingerprint: string
}

export const isEditorUnsavedDirtyByFingerprint = ({
  isSaving,
  editorMode,
  hasSelectedManagedPost,
  editorStateFingerprint,
  serverBaselineFingerprint,
  localDraftFingerprint,
  localDraftSavedAt,
  pristineCreateFingerprint,
}: EditorUnsavedDirtyFingerprintInput): boolean => {
  if (isSaving) return true

  if (editorMode === "edit") {
    if (hasSelectedManagedPost) {
      return editorStateFingerprint !== serverBaselineFingerprint
    }
    return editorStateFingerprint !== pristineCreateFingerprint
  }

  const hasActiveLocalDraftBaseline =
    Boolean(localDraftSavedAt) && editorStateFingerprint !== pristineCreateFingerprint
  if (hasActiveLocalDraftBaseline) {
    return editorStateFingerprint !== localDraftFingerprint
  }
  return editorStateFingerprint !== pristineCreateFingerprint
}

const resolveFirstDelimiterIndex = (queryIdx: number, hashIdx: number) => {
  if (queryIdx === -1) return hashIdx
  if (hashIdx === -1) return queryIdx
  return Math.min(queryIdx, hashIdx)
}

const editorRoutePathname = (url: string) => {
  const endIdx = resolveFirstDelimiterIndex(url.indexOf("?"), url.indexOf("#"))
  return endIdx === -1 ? url : url.slice(0, endIdx)
}

let scheduledForcedEditorExitPath: string | null = null
let activeForcedEditorExitPath: string | null = null

export const scheduleForcedEditorExitUrl = (url: string) => {
  scheduledForcedEditorExitPath = editorRoutePathname(url)
}

export const activateScheduledForcedEditorExitIfMatching = (url: string) => {
  const path = editorRoutePathname(url)
  if (scheduledForcedEditorExitPath !== null && path === scheduledForcedEditorExitPath) {
    activeForcedEditorExitPath = scheduledForcedEditorExitPath
    scheduledForcedEditorExitPath = null
  }
}

export const clearForcedEditorExitUrl = () => {
  scheduledForcedEditorExitPath = null
  activeForcedEditorExitPath = null
}

export const clearActiveForcedEditorExitUrl = () => {
  activeForcedEditorExitPath = null
}

export const clearScheduledForcedEditorExitUrl = () => {
  scheduledForcedEditorExitPath = null
}

export const consumeForcedEditorExitUrl = (url: string) => {
  const path = editorRoutePathname(url)
  if (activeForcedEditorExitPath !== null && path === activeForcedEditorExitPath) {
    activeForcedEditorExitPath = null
  }
}

export const isForcedEditorExitUrl = (url: string) => {
  const path = editorRoutePathname(url)
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return true
  return activeForcedEditorExitPath !== null && path === activeForcedEditorExitPath
}

export const allowForcedEditorExitRoute = (url: string) => {
  if (!isForcedEditorExitUrl(url)) return false
  consumeForcedEditorExitUrl(url)
  return true
}

export const shouldBlockEditorBeforeUnload = (isDirty: boolean, bypassForcedExit: boolean) =>
  isDirty && !bypassForcedExit

export const isSamePathEditorSurfaceNavigation = (currentUrl: string, nextUrl: string) =>
  editorRoutePathname(currentUrl) === editorRoutePathname(nextUrl)

export const isEditorStudioBootstrapNavigation = (currentUrl: string, nextUrl: string) => {
  const current = editorRoutePathname(currentUrl)
  const next = editorRoutePathname(nextUrl)
  if (current !== "/admin/editor/new") return false
  if (!next.startsWith("/admin/editor/")) return false
  const segment = next.slice("/admin/editor/".length)
  return segment.length > 0 && segment !== "new" && !segment.includes("/")
}

export type EditorRouteNavigationMethod = "push" | "replace"

export type EditorRouteNavigationIntent = {
  method: EditorRouteNavigationMethod
  shallow?: boolean
  scroll?: boolean
}

export type EditorRouteNavigationRetry = {
  url: string
  method: EditorRouteNavigationMethod
  options: { shallow?: boolean; scroll?: boolean }
}

type EditorRouteTransitionOptions = {
  shallow?: boolean
  scroll?: boolean
}

export const defaultEditorRouteNavigationIntent = (): EditorRouteNavigationIntent => ({
  method: "push",
})

export const captureEditorRouteNavigationIntent = (
  method: EditorRouteNavigationMethod,
  options?: EditorRouteTransitionOptions
): EditorRouteNavigationIntent => ({
  method,
  ...(typeof options?.shallow === "boolean" ? { shallow: options.shallow } : {}),
  ...(typeof options?.scroll === "boolean" ? { scroll: options.scroll } : {}),
})

export const buildEditorRouteNavigationOptions = (
  intent: EditorRouteNavigationIntent
): EditorRouteNavigationRetry["options"] => {
  const options: EditorRouteNavigationRetry["options"] = {}
  if (typeof intent.shallow === "boolean") options.shallow = intent.shallow
  if (typeof intent.scroll === "boolean") options.scroll = intent.scroll
  return options
}

export const resolveEditorRouteNavigationRetry = (
  url: string,
  intent: EditorRouteNavigationIntent | null | undefined
): EditorRouteNavigationRetry => {
  const resolvedIntent = intent ?? defaultEditorRouteNavigationIntent()
  return {
    url,
    method: resolvedIntent.method,
    options: buildEditorRouteNavigationOptions(resolvedIntent),
  }
}

type EditorHistoryLike = Pick<History, "pushState"> & { readonly state?: unknown }

export const restoreEditorUrlAfterBlockedHistoryPop = (
  editorAsPath: string,
  history: EditorHistoryLike | null | undefined = typeof globalThis !== "undefined"
    ? (globalThis as typeof globalThis & { window?: Window }).window?.history
    : undefined,
  historyState?: unknown
) => {
  const state = typeof historyState !== "undefined" ? historyState : (history?.state ?? null)
  history?.pushState(state, "", editorAsPath)
}

export const readHistoryStateIndex = (state: unknown): number | null => {
  if (!state || typeof state !== "object") return null
  const record = state as Record<string, unknown>
  if (typeof record.idx === "number" && Number.isFinite(record.idx)) return record.idx
  if (typeof record.index === "number" && Number.isFinite(record.index)) return record.index
  return null
}

export const readHistoryStateKey = (state: unknown): string | null => {
  if (!state || typeof state !== "object") return null
  const key = (state as Record<string, unknown>).key
  return typeof key === "string" && key.length > 0 ? key : null
}

export const resolveBlockedHistoryNavigationDelta = (
  editorState: unknown,
  poppedState: unknown,
  keyOrderMap?: ReadonlyMap<string, number>
): number => {
  const editorIndex = readHistoryStateIndex(editorState)
  const poppedIndex = readHistoryStateIndex(poppedState)
  if (editorIndex !== null && poppedIndex !== null && poppedIndex !== editorIndex) {
    return poppedIndex - editorIndex
  }
  if (keyOrderMap) {
    const editorKey = readHistoryStateKey(editorState)
    const poppedKey = readHistoryStateKey(poppedState)
    if (editorKey && poppedKey && editorKey !== poppedKey) {
      const trackedEditor = keyOrderMap.get(editorKey)
      const trackedPopped = keyOrderMap.get(poppedKey)
      if (trackedEditor !== undefined && trackedPopped !== undefined && trackedPopped !== trackedEditor) {
        return trackedPopped - trackedEditor
      }
    }
  }
  return -1
}
