import { type DehydratedState, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiFetch } from "src/apis/backend/client"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import type { AuthMember } from "src/hooks/useAuthSession"
import useAuthSession from "src/hooks/useAuthSession"
import { setAdminProfileCache, refreshAdminProfileCache, type AdminProfile } from "src/hooks/useAdminProfile"
import { refreshAdminShellProfile } from "src/hooks/useAdminShellProfile"
import { setProfileWorkspaceCache, useProfileWorkspace } from "src/hooks/useProfileWorkspace"
import {
  ProfileWorkspaceContent,
  ProfileWorkspaceResponse,
} from "src/libs/profileWorkspace"
import { reconcileProfileWorkspaceDraft, saveProfileWorkspaceImage } from "src/libs/profileWorkspaceImage"
import {
  computeProfileDirtyMask,
  type LinkTab,
  type PreviewMode,
  type WorkspaceSectionId,
} from "src/routes/Admin/AdminProfileWorkspaceModel"

export { computeProfileDirtyMask } from "src/routes/Admin/AdminProfileWorkspaceModel"
import {
  PROFILE_UNSAVED_CHANGES_MESSAGE,
  revalidatePublicBlogAppearance,
} from "src/routes/Admin/AdminProfilePersistenceModel"
import {
  type OpenIconPicker,
  useAdminProfileWorkspaceDraftActions,
} from "src/routes/Admin/AdminProfileWorkspacePageDraftActions"
import { useAdminProfileWorkspaceImageDraft } from "src/routes/Admin/AdminProfileWorkspacePageImageDraft"
import {
  buildProfileDraftPayload,
  computeWorkspaceDirtyState,
  validateProfileDraftBeforePersistence,
} from "./AdminProfileWorkspacePersistenceHelpers"

export type NoticeTone = "idle" | "loading" | "success" | "error"

export type AdminProfileWorkspacePageProps = {
  dehydratedState: DehydratedState
  initialMember: AuthMember
  initialProfileSnapshot?: AdminProfile | null
  initialWorkspace: ProfileWorkspaceResponse | null
}

export type ReadyProfileWorkspaceProps = Omit<AdminProfileWorkspacePageProps, "initialWorkspace"> & {
  initialWorkspace: ProfileWorkspaceResponse
  workspaceQuery: ReturnType<typeof useProfileWorkspace>
}

export const useAdminProfileWorkspacePageModel = ({
  initialMember,
  initialProfileSnapshot = null,
  initialWorkspace,
  workspaceQuery,
}: ReadyProfileWorkspaceProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { me, authStatus, setMe } = useAuthSession()
  const sessionMember =
    authStatus === "loading" || authStatus === "unavailable" ? initialMember : me || initialMember

  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>("identity")
  const [linkTab, setLinkTab] = useState<LinkTab>("service")
  const [previewMode, setPreviewMode] = useState<PreviewMode>("draft")
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [draggingLinkIndex, setDraggingLinkIndex] = useState<number | null>(null)
  const [dragOverLinkIndex, setDragOverLinkIndex] = useState<number | null>(null)
  const [dragOverLinkPosition, setDragOverLinkPosition] = useState<"before" | "after" | null>(null)
  const [openIconPicker, setOpenIconPicker] = useState<OpenIconPicker>(null)
  const [loadingKey, setLoadingKey] = useState("")
  const [workspaceNotice, setWorkspaceNotice] = useState<{ tone: NoticeTone; text: string }>({
    tone: "idle",
    text: "",
  })
  const [imageNotice, setImageNotice] = useState<{ tone: NoticeTone; text: string }>({
    tone: "idle",
    text: "",
  })
  const [displayNameInput, setDisplayNameInput] = useState(
    (initialMember.nickname || initialMember.username || "").trim()
  )
  const [remoteDraft, setRemoteDraft] = useState<ProfileWorkspaceContent>(initialWorkspace.draft)
  const [publishedSnapshot, setPublishedSnapshot] = useState<ProfileWorkspaceContent>(initialWorkspace.published)
  const [draft, setDraftState] = useState<ProfileWorkspaceContent>(initialWorkspace.draft)
  const remoteDraftRef = useRef<ProfileWorkspaceContent>(initialWorkspace.draft)
  const draftRef = useRef<ProfileWorkspaceContent>(initialWorkspace.draft)
  const setDraft: Dispatch<SetStateAction<ProfileWorkspaceContent>> = useCallback((next) => {
    const resolved = typeof next === "function" ? next(draftRef.current) : next
    draftRef.current = resolved
    setDraftState(resolved)
  }, [])
  const {
    addAboutItem, addAboutProject, addAboutSection, appendLinkItem, moveAboutItem, moveAboutProject,
    moveAboutSection, moveLinkItem, removeAboutItem, removeAboutProject, removeAboutSection,
    removeLinkItem, reorderLinkItems, updateAboutProject, updateAboutSection, updateDraft, updateLinkItem,
  } = useAdminProfileWorkspaceDraftActions({ setDraft, setOpenIconPicker })

  const applyWorkspaceState = useCallback(
    (workspace: ProfileWorkspaceResponse) => {
      const previousRemoteDraft = remoteDraftRef.current
      remoteDraftRef.current = workspace.draft
      setRemoteDraft(workspace.draft)
      setPublishedSnapshot(workspace.published)
      setDraft((currentDraft) => reconcileProfileWorkspaceDraft(currentDraft, previousRemoteDraft, workspace.draft))
      if (sessionMember?.id) {
        setProfileWorkspaceCache(queryClient, sessionMember.id, workspace)
      }
    },
    [queryClient, sessionMember, setDraft]
  )

  useEffect(() => {
    if (!workspaceQuery.data) return
    applyWorkspaceState(workspaceQuery.data)
  }, [applyWorkspaceState, workspaceQuery.data])

  const saveProfileImage = useCallback(
    async (memberId: number, profileImageUrl: string) => {
      const nextWorkspace = await saveProfileWorkspaceImage(memberId, draftRef.current, profileImageUrl)
      applyWorkspaceState(nextWorkspace)
      setDraft((currentDraft) => ({ ...currentDraft, profileImageUrl }))
      void invalidatePublicPostReadCaches(queryClient)
      void revalidatePublicBlogAppearance()
    },
    [applyWorkspaceState, queryClient, setDraft]
  )

  useEffect(() => {
    const nextDisplayName = (sessionMember?.nickname || sessionMember?.username || "").trim()
    setDisplayNameInput(nextDisplayName)
  }, [sessionMember?.nickname, sessionMember?.username])

  useEffect(() => {
    if (workspaceNotice.tone !== "success" && workspaceNotice.tone !== "error") return
    const timeout = window.setTimeout(() => {
      setWorkspaceNotice({ tone: "idle", text: "" })
    }, 3600)
    return () => window.clearTimeout(timeout)
  }, [workspaceNotice])

  useEffect(() => {
    if (imageNotice.tone !== "success" && imageNotice.tone !== "error") return
    const timeout = window.setTimeout(() => {
      setImageNotice({ tone: "idle", text: "" })
    }, 3600)
    return () => window.clearTimeout(timeout)
  }, [imageNotice])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("[data-icon-picker-root='true']")) return
      setOpenIconPicker(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenIconPicker(null)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  // 단 1회의 useMemo로 모든 더티 상태 및 섹션 상태 계산 (무할당 단일 패스)
  const sessionMemberDisplayName = (sessionMember?.nickname || sessionMember?.username || "").trim()
  const dirtyState = useMemo(
    () =>
      computeWorkspaceDirtyState(
        draft,
        remoteDraft,
        publishedSnapshot,
        sessionMemberDisplayName,
        displayNameInput
      ),
    [displayNameInput, draft, publishedSnapshot, remoteDraft, sessionMemberDisplayName]
  )

  const {
    hasWorkspaceUnsavedChanges,
    hasDisplayNameDirty,
    hasUnsavedChanges,
    hasPublishedDiff,
    sectionStateMap,
  } = dirtyState

  useEffect(() => {
    if (typeof window === "undefined" || !sessionMember || !hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = PROFILE_UNSAVED_CHANGES_MESSAGE
      return PROFILE_UNSAVED_CHANGES_MESSAGE
    }

    const handleRouteChangeStart = (nextUrl: string) => {
      if (nextUrl === router.asPath) return
      const confirmed = window.confirm(PROFILE_UNSAVED_CHANGES_MESSAGE)
      if (confirmed) return

      if (typeof window !== "undefined" && window.location.pathname !== router.asPath) {
        window.history.pushState(null, "", router.asPath)
      }

      router.events.emit("routeChangeError")
      const error = new Error("Navigation aborted due to unsaved profile changes.") as Error & {
        cancelled?: boolean
      }
      error.cancelled = true
      throw error
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    router.events.on("routeChangeStart", handleRouteChangeStart)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      router.events.off("routeChangeStart", handleRouteChangeStart)
    }
  }, [hasUnsavedChanges, router, sessionMember])

  const {
    clearProfileImageDraft,
    finalizeProfileImageDraftPointer,
    handleApplyProfileImageDraft,
    handleDraftFileChange,
    handleProfileImageDraftPointerDown,
    handleProfileImageDraftPointerMove,
    handleDeletePreviousProfileImage,
    handleSelectPreviousProfileImage,
    isProfileImageDraftDragging,
    isProfileImageEditorOpen,
    profileImageDraftFile,
    profileImageDraftFrameRef,
    profileImageDraftNotice,
    profileImageDraftPreviewUrl,
    profileImageDraftTransformRef,
    profileImageDraftZoom,
    profileImageFileInputRef,
    profileImageFileName,
    previousProfileImages,
    resetProfileImageDraftInteractions,
    scheduleProfileImageDraftTransform,
    setIsProfileImageEditorOpen,
  } = useAdminProfileWorkspaceImageDraft({
    sessionMemberId: sessionMember?.id,
    saveProfileImage,
    setImageNotice,
    setLoadingKey,
  })

  const persistDisplayName = useCallback(
    async (memberId: number, nickname: string) => {
      const updatedMember = await apiFetch<AuthMember & AdminProfile>(`/member/api/v1/adm/members/${memberId}/nickname`, {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
      })
      setMe(updatedMember)
      setAdminProfileCache(queryClient, updatedMember)
      await invalidatePublicPostReadCaches(queryClient)
      return updatedMember
    },
    [queryClient, setMe]
  )

  const validateDraft = useCallback(
    () =>
      validateProfileDraftBeforePersistence(
        draft,
        displayNameInput,
        hasDisplayNameDirty,
        setWorkspaceNotice,
        setActiveSection,
        setLinkTab
      ),
    [displayNameInput, draft, hasDisplayNameDirty]
  )

  const saveWorkspaceDraft = useCallback(async () => {
    if (!sessionMember?.id) {
      throw new Error("관리자 세션을 확인할 수 없습니다.")
    }

    const normalizedDraft = buildProfileDraftPayload(draft)
    return apiFetch<ProfileWorkspaceResponse>(`/member/api/v1/adm/members/${sessionMember.id}/profileWorkspace/draft`, {
      method: "PUT",
      body: JSON.stringify(normalizedDraft),
    })
  }, [draft, sessionMember?.id])

  const handleSaveDraft = useCallback(async () => {
    if (!sessionMember?.id || !validateDraft()) return

    const normalizedDisplayName = displayNameInput.trim()
    const shouldSaveDisplayName = hasDisplayNameDirty
    const shouldSaveWorkspace = hasWorkspaceUnsavedChanges

    if (!shouldSaveDisplayName && !shouldSaveWorkspace) {
      setWorkspaceNotice({ tone: "idle", text: "이미 최신 상태입니다." })
      return
    }

    const saveBoth = shouldSaveWorkspace && shouldSaveDisplayName
    let loadingText = "임시 저장 중..."
    if (saveBoth) loadingText = "임시 저장과 계정 이름 저장을 함께 처리하고 있습니다..."
    else if (shouldSaveDisplayName) loadingText = "계정 이름을 저장하고 있습니다..."

    let workspaceSaved = false

    try {
      setLoadingKey("save")
      setWorkspaceNotice({ tone: "loading", text: loadingText })

      if (shouldSaveWorkspace) {
        const nextWorkspace = await saveWorkspaceDraft()
        applyWorkspaceState(nextWorkspace)
        workspaceSaved = true
      }

      if (shouldSaveDisplayName) {
        await persistDisplayName(sessionMember.id, normalizedDisplayName)
        void revalidatePublicBlogAppearance()
      }

      let successText = "임시 저장했습니다."
      if (saveBoth) successText = "임시 저장과 계정 이름 업데이트를 완료했습니다."
      else if (shouldSaveDisplayName) successText = "계정 이름을 저장했습니다."

      setWorkspaceNotice({ tone: "success", text: successText })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      let failureText = "임시 저장 실패"
      if (saveBoth) failureText = "임시 저장 또는 계정 이름 저장 실패"
      else if (shouldSaveDisplayName) failureText = "계정 이름 저장 실패"

      setWorkspaceNotice({
        tone: "error",
        text:
          workspaceSaved && shouldSaveDisplayName
            ? `임시 저장은 완료됐지만 계정 이름 저장은 실패했습니다: ${message}`
            : `${failureText}: ${message}`,
      })
    } finally {
      setLoadingKey("")
    }
  }, [
    applyWorkspaceState,
    displayNameInput,
    hasDisplayNameDirty,
    hasWorkspaceUnsavedChanges,
    persistDisplayName,
    saveWorkspaceDraft,
    sessionMember?.id,
    validateDraft,
  ])

  const handlePublish = useCallback(async () => {
    if (!sessionMember?.id) return
    if (!validateDraft()) return

    const normalizedDisplayName = displayNameInput.trim()
    const shouldSaveDisplayName = hasDisplayNameDirty
    const shouldSaveWorkspace = hasWorkspaceUnsavedChanges
    const shouldApplyWorkspace = shouldSaveWorkspace || hasPublishedDiff

    if (!shouldSaveDisplayName && !shouldApplyWorkspace) {
      setWorkspaceNotice({ tone: "idle", text: "이미 공개본과 편집 중인 내용이 같습니다." })
      return
    }

    let workspaceForPublish: ProfileWorkspaceResponse | null = null

    try {
      setLoadingKey("publish")
      setWorkspaceNotice({
        tone: "loading",
        text: shouldSaveWorkspace ? "초안을 저장한 뒤 공개 적용 중..." : "공개 적용 중...",
      })

      if (shouldSaveWorkspace) {
        workspaceForPublish = await saveWorkspaceDraft()
      }

      if (shouldSaveDisplayName) {
        await persistDisplayName(sessionMember.id, normalizedDisplayName)
      }

      const shouldPublishWorkspace = workspaceForPublish?.dirtyFromPublished ?? hasPublishedDiff
      if (shouldPublishWorkspace) {
        const nextWorkspace = await apiFetch<ProfileWorkspaceResponse>(
          `/member/api/v1/adm/members/${sessionMember.id}/profileWorkspace/publish`,
          {
            method: "POST",
          }
        )
        applyWorkspaceState(nextWorkspace)
        await refreshAdminShellProfile(queryClient, sessionMember.id)
        const profileRefreshed = await refreshAdminProfileCache(queryClient)
        await invalidatePublicPostReadCaches(queryClient)
        const publicCacheRevalidated = await revalidatePublicBlogAppearance()
        const isPublicSiteUpdated = profileRefreshed && publicCacheRevalidated
        setPreviewMode("published")
        setWorkspaceNotice({
          tone: isPublicSiteUpdated ? "success" : "error",
          text: isPublicSiteUpdated
            ? "공개 적용과 공개 사이트 갱신을 완료했습니다."
            : "공개 적용은 완료됐지만 공개 사이트 캐시 갱신에 실패했습니다. 잠시 후 새로고침해주세요.",
        })
        return
      }

      if (shouldSaveDisplayName) {
        void revalidatePublicBlogAppearance()
      }
      if (workspaceForPublish) {
        applyWorkspaceState(workspaceForPublish)
      }
      setWorkspaceNotice({ tone: "success", text: "변경 사항을 저장했습니다." })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setWorkspaceNotice({ tone: "error", text: `공개 적용 실패: ${message}` })
    } finally {
      setLoadingKey("")
    }
  }, [
    applyWorkspaceState,
    displayNameInput,
    hasDisplayNameDirty,
    hasPublishedDiff,
    hasWorkspaceUnsavedChanges,
    persistDisplayName,
    saveWorkspaceDraft,
    sessionMember?.id,
    queryClient,
    validateDraft,
  ])

  useEffect(() => {
    setDraggingLinkIndex(null)
    setDragOverLinkIndex(null)
  }, [linkTab])

  if (!sessionMember) return null
  return {
    initialProfileSnapshot,
    sessionMember,
    activeSection,
    setActiveSection,
    linkTab,
    setLinkTab,
    previewMode,
    setPreviewMode,
    isPreviewExpanded,
    setIsPreviewExpanded,
    draggingLinkIndex,
    setDraggingLinkIndex,
    dragOverLinkIndex,
    setDragOverLinkIndex,
    dragOverLinkPosition,
    setDragOverLinkPosition,
    openIconPicker,
    setOpenIconPicker,
    loadingKey,
    workspaceNotice,
    imageNotice,
    displayNameInput,
    setDisplayNameInput,
    publishedSnapshot,
    draft,
    profileImageFileName,
    isProfileImageEditorOpen,
    setIsProfileImageEditorOpen,
    profileImageDraftFile,
    profileImageDraftPreviewUrl,
    profileImageDraftZoom,
    profileImageDraftNotice,
    profileImageDraftFrameRef,
    profileImageFileInputRef,
    previousProfileImages,
    hasUnsavedChanges,
    hasPublishedDiff,
    sectionStateMap,
    updateDraft,
    updateLinkItem,
    appendLinkItem,
    removeLinkItem,
    moveLinkItem,
    reorderLinkItems,
    updateAboutSection,
    addAboutSection,
    removeAboutSection,
    moveAboutSection,
    addAboutItem,
    removeAboutItem,
    moveAboutItem,
    updateAboutProject,
    addAboutProject,
    removeAboutProject,
    moveAboutProject,
    finalizeProfileImageDraftPointer,
    handleProfileImageDraftPointerDown,
    handleProfileImageDraftPointerMove,
    handleDeletePreviousProfileImage,
    handleSelectPreviousProfileImage,
    isProfileImageDraftDragging,
    resetProfileImageDraftInteractions,
    scheduleProfileImageDraftTransform,
    profileImageDraftTransformRef,
    clearProfileImageDraft,
    handleDraftFileChange,
    handleApplyProfileImageDraft,
    handleSaveDraft,
    handlePublish,
  }
}

export type AdminProfileWorkspaceSectionProps = NonNullable<
  ReturnType<typeof useAdminProfileWorkspacePageModel>
>
