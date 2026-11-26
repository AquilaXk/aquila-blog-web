import { useCallback, useEffect, useState } from "react"
import type { NextRouter } from "next/router"
import {
  createAdminTempDraft,
  deleteAdminTempDraft,
  listAdminSeriesNames,
  listAdminTempDrafts,
} from "src/apis/backend/posts/PostApiAdminDraftRequests"
import type { ApiPostDto } from "src/apis/backend/posts/PostApiDtos"

export const toLocalDateTimeInputValue = (isoUtc: string): string => {
  const trimmed = isoUtc.trim()
  if (!trimmed) return ""
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const fromLocalDateTimeInputValue = (localVal: string): string => {
  const trimmed = localVal.trim()
  if (!trimmed) return ""
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString()
}

export const isScheduleTimestampValid = (isoUtc: string, nowMs: number = Date.now()): boolean => {
  const trimmed = isoUtc.trim()
  if (!trimmed) return true
  const parsedMs = Date.parse(trimmed)
  if (!Number.isFinite(parsedMs)) return false
  return parsedMs >= nowMs - 30_000
}

export const useEditorStudioPublishingMetadata = ({
  router,
  postId,
  toEditorPostRoute,
  editorNewRoutePath,
  isAuthenticatedAdmin,
}: {
  router: NextRouter
  postId: string
  toEditorPostRoute: (id: string | number) => string
  editorNewRoutePath: string
  isAuthenticatedAdmin: boolean
}) => {
  const [postScheduledAt, setPostScheduledAt] = useState("")
  const [postSeriesName, setPostSeriesName] = useState("")
  const [postSeriesOrder, setPostSeriesOrder] = useState<number | null>(null)
  const [postCanonicalUrl, setPostCanonicalUrl] = useState("")
  const [seriesCatalog, setSeriesCatalog] = useState<string[]>([])
  const [adminTempDrafts, setAdminTempDrafts] = useState<ApiPostDto[]>([])
  const [isTempDraftsLoading, setIsTempDraftsLoading] = useState(false)
  const [isTempDraftDrawerOpen, setIsTempDraftDrawerOpen] = useState(false)

  const refreshAdminSeriesCatalog = useCallback(async () => {
    if (!isAuthenticatedAdmin) return
    try {
      const names = await listAdminSeriesNames()
      setSeriesCatalog(names)
    } catch {
      // Keep existing catalog silently on background refresh failure
    }
  }, [isAuthenticatedAdmin])

  const refreshAdminTempDrafts = useCallback(async () => {
    if (!isAuthenticatedAdmin) return
    setIsTempDraftsLoading(true)
    try {
      const drafts = await listAdminTempDrafts()
      setAdminTempDrafts(drafts)
    } catch {
      setAdminTempDrafts([])
    } finally {
      setIsTempDraftsLoading(false)
    }
  }, [isAuthenticatedAdmin])

  useEffect(() => {
    if (!isAuthenticatedAdmin) return
    void refreshAdminSeriesCatalog()
  }, [isAuthenticatedAdmin, refreshAdminSeriesCatalog])

  useEffect(() => {
    if (!isAuthenticatedAdmin || !isTempDraftDrawerOpen) return
    void refreshAdminTempDrafts()
  }, [isAuthenticatedAdmin, isTempDraftDrawerOpen, refreshAdminTempDrafts])

  const handleOpenTempDraftDrawer = useCallback(() => {
    setIsTempDraftDrawerOpen(true)
  }, [])

  const handleCloseTempDraftDrawer = useCallback(() => {
    setIsTempDraftDrawerOpen(false)
  }, [])

  const handleSelectTempDraft = useCallback(
    async (draftId: string | number) => {
      setIsTempDraftDrawerOpen(false)
      await router.push(toEditorPostRoute(draftId))
    },
    [router, toEditorPostRoute]
  )

  const handleCreateNewTempDraft = useCallback(async () => {
    setIsTempDraftsLoading(true)
    try {
      const res = await createAdminTempDraft()
      const createdId = res?.data?.id
      if (createdId) {
        setIsTempDraftDrawerOpen(false)
        await router.push(toEditorPostRoute(createdId))
      } else {
        await refreshAdminTempDrafts()
      }
    } finally {
      setIsTempDraftsLoading(false)
    }
  }, [refreshAdminTempDrafts, router, toEditorPostRoute])

  const handleDeleteAdminTempDraft = useCallback(
    async (draftId: string | number) => {
      setIsTempDraftsLoading(true)
      try {
        await deleteAdminTempDraft(draftId)
        const remaining = await listAdminTempDrafts()
        setAdminTempDrafts(remaining)
        if (String(draftId) === postId.trim()) {
          setIsTempDraftDrawerOpen(false)
          if (remaining[0]?.id) {
            await router.replace(toEditorPostRoute(remaining[0].id))
          } else {
            await router.replace(editorNewRoutePath)
          }
        }
      } finally {
        setIsTempDraftsLoading(false)
      }
    },
    [editorNewRoutePath, postId, router, toEditorPostRoute]
  )

  return {
    postScheduledAt,
    setPostScheduledAt,
    postSeriesName,
    setPostSeriesName,
    postSeriesOrder,
    setPostSeriesOrder,
    postCanonicalUrl,
    setPostCanonicalUrl,
    seriesCatalog,
    refreshAdminSeriesCatalog,
    adminTempDrafts,
    isTempDraftsLoading,
    isTempDraftDrawerOpen,
    refreshAdminTempDrafts,
    handleOpenTempDraftDrawer,
    handleCloseTempDraftDrawer,
    handleSelectTempDraft,
    handleCreateNewTempDraft,
    handleDeleteAdminTempDraft,
  }
}
