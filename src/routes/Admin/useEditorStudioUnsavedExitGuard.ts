import { useRouter } from "next/router"
import { createElement, useCallback, useEffect, useId, useRef, useState } from "react"
import { ConfirmDialog } from "src/design-system/ConfirmDialog"
import type { UrlObject } from "url"
import {
  activateScheduledForcedEditorExitIfMatching,
  allowForcedEditorExitRoute,
  captureEditorRouteNavigationIntent,
  clearActiveForcedEditorExitUrl,
  clearForcedEditorExitUrl,
  defaultEditorRouteNavigationIntent,
  EDITOR_UNSAVED_CHANGES_MESSAGE,
  isEditorStudioBootstrapNavigation,
  isSamePathEditorSurfaceNavigation,
  resolveEditorRouteNavigationRetry,
  restoreEditorUrlAfterBlockedHistoryPop,
  shouldBlockEditorBeforeUnload,
  type EditorRouteNavigationIntent,
} from "./editorStudioUnsavedExitGuard"

type UseEditorStudioUnsavedExitGuardParams = {
  enabled: boolean
  isDirty: boolean
  getIsDirty?: () => boolean
}

type PendingNavigation = {
  kind: "route" | "action" | "history"
  url?: string
  action?: () => void
  routeIntent?: EditorRouteNavigationIntent
}

const resolveRouterNavigationUrl = (
  url: string | UrlObject,
  asPath?: string | UrlObject | null
): string => {
  if (typeof url === "string") return url
  if (typeof asPath === "string") return asPath
  const pathname = typeof url.pathname === "string" ? url.pathname : ""
  const search =
    typeof url.query === "string"
      ? url.query.startsWith("?")
        ? url.query
        : `?${url.query}`
      : url.query && typeof url.query === "object"
        ? `?${new URLSearchParams(url.query as Record<string, string>).toString()}`
        : ""
  return `${pathname}${search}`
}

export const useEditorStudioUnsavedExitGuard = ({
  enabled,
  isDirty,
  getIsDirty,
}: UseEditorStudioUnsavedExitGuardParams) => {
  const titleId = useId()
  const descriptionId = useId()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingRef = useRef<PendingNavigation | null>(null)
  const allowNavigationRef = useRef(false)
  const allowBeforeUnloadBypassRef = useRef(false)
  const pendingRouteIntentRef = useRef<EditorRouteNavigationIntent | null>(null)
  const editorHistoryStateRef = useRef<unknown>(null)
  const getIsDirtyRef = useRef(getIsDirty)
  const isDirtyRef = useRef(isDirty)
  getIsDirtyRef.current = getIsDirty
  isDirtyRef.current = isDirty

  const readIsDirty = useCallback(() => {
    const live = getIsDirtyRef.current
    return typeof live === "function" ? live() : isDirtyRef.current
  }, [])

  const clearAllowNavigation = useCallback(() => {
    allowNavigationRef.current = false
  }, [])

  const closeConfirm = useCallback(() => {
    pendingRef.current = null
    setConfirmOpen(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      closeConfirm()
      return
    }
    if (!isDirty && !readIsDirty()) {
      closeConfirm()
    }
  }, [closeConfirm, enabled, isDirty, readIsDirty])

  const confirmLeave = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = null
    setConfirmOpen(false)
    if (!pending) return

    if (pending.kind === "action") {
      allowNavigationRef.current = true
      pending.action?.()
      return
    }

    if (pending.kind === "history") {
      allowNavigationRef.current = true
      window.history.back()
      return
    }

    if (!pending.url) return
    const retry = resolveEditorRouteNavigationRetry(pending.url, pending.routeIntent)
    allowNavigationRef.current = true
    const navigate = retry.method === "replace" ? router.replace.bind(router) : router.push.bind(router)
    void navigate(retry.url, undefined, retry.options)
  }, [router])

  const requestGuardedAction = useCallback(
    (action: () => void) => {
      if (!enabled || !readIsDirty()) {
        action()
        return
      }
      pendingRef.current = { kind: "action", action }
      setConfirmOpen(true)
    },
    [enabled, readIsDirty]
  )

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return

    const captureEditorHistoryState = () => {
      editorHistoryStateRef.current = window.history.state
    }
    captureEditorHistoryState()

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlockEditorBeforeUnload(readIsDirty(), allowBeforeUnloadBypassRef.current)) return
      event.preventDefault()
      event.returnValue = EDITOR_UNSAVED_CHANGES_MESSAGE
      return EDITOR_UNSAVED_CHANGES_MESSAGE
    }

    const originalPush = router.push.bind(router)
    const originalReplace = router.replace.bind(router)

    router.push = ((url, as, options) => {
      pendingRouteIntentRef.current = captureEditorRouteNavigationIntent("push", options)
      activateScheduledForcedEditorExitIfMatching(resolveRouterNavigationUrl(url, as))
      return originalPush(url, as, options)
    }) as typeof router.push

    router.replace = ((url, as, options) => {
      pendingRouteIntentRef.current = captureEditorRouteNavigationIntent("replace", options)
      activateScheduledForcedEditorExitIfMatching(resolveRouterNavigationUrl(url, as))
      return originalReplace(url, as, options)
    }) as typeof router.replace

    router.beforePopState(({ as }) => {
      if (allowNavigationRef.current) {
        clearAllowNavigation()
        return true
      }

      if (allowForcedEditorExitRoute(as)) {
        allowBeforeUnloadBypassRef.current = true
        return true
      }
      if (isSamePathEditorSurfaceNavigation(router.asPath, as)) return true
      if (!readIsDirty()) return true

      pendingRef.current = { kind: "history" }
      setConfirmOpen(true)
      restoreEditorUrlAfterBlockedHistoryPop(
        router.asPath,
        window.history,
        editorHistoryStateRef.current
      )
      captureEditorHistoryState()
      return false
    })

    const handleRouteChangeStart = (nextUrl: string) => {
      const capturedIntent = pendingRouteIntentRef.current
      pendingRouteIntentRef.current = null

      if (allowForcedEditorExitRoute(nextUrl)) {
        allowBeforeUnloadBypassRef.current = true
        return
      }

      if (!readIsDirty()) return
      if (allowNavigationRef.current) return
      if (nextUrl === router.asPath) return
      if (isSamePathEditorSurfaceNavigation(router.asPath, nextUrl)) return
      if (isEditorStudioBootstrapNavigation(router.asPath, nextUrl)) return

      pendingRef.current = {
        kind: "route",
        url: nextUrl,
        routeIntent: capturedIntent ?? defaultEditorRouteNavigationIntent(),
      }
      setConfirmOpen(true)
      router.events.emit("routeChangeError")
      const error = new Error("Navigation aborted due to unsaved editor changes.") as Error & {
        cancelled?: boolean
      }
      error.cancelled = true
      throw error
    }

    const handleRouteChangeComplete = () => {
      clearAllowNavigation()
      captureEditorHistoryState()
    }

    const handleRouteChangeError = () => {
      clearAllowNavigation()
      allowBeforeUnloadBypassRef.current = false
      clearActiveForcedEditorExitUrl()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    router.events.on("routeChangeStart", handleRouteChangeStart)
    router.events.on("routeChangeComplete", handleRouteChangeComplete)
    router.events.on("routeChangeError", handleRouteChangeError)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      router.events.off("routeChangeStart", handleRouteChangeStart)
      router.events.off("routeChangeComplete", handleRouteChangeComplete)
      router.events.off("routeChangeError", handleRouteChangeError)
      router.beforePopState(() => true)
      router.push = originalPush
      router.replace = originalReplace
      pendingRouteIntentRef.current = null
      clearAllowNavigation()
      allowBeforeUnloadBypassRef.current = false
      clearForcedEditorExitUrl()
    }
  }, [clearAllowNavigation, enabled, readIsDirty, router])

  const dialog = createElement(ConfirmDialog, {
    open: confirmOpen,
    titleId,
    descriptionId,
    title: "저장되지 않은 변경이 있습니다",
    description: EDITOR_UNSAVED_CHANGES_MESSAGE,
    confirmLabel: "나가기",
    cancelLabel: "계속 작성",
    confirmTone: "danger",
    onConfirm: confirmLeave,
    onCancel: closeConfirm,
  })

  return {
    requestGuardedAction,
    dialog,
  }
}
