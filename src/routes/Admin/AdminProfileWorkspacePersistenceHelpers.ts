// 참조 구현: TryGhost/Ghost (MIT) & payloadcms/payload (MIT) — 프로필 워크스페이스 상태 계산 및 저장 헬퍼
import {
  type ProfileWorkspaceContent,
  normalizeProfileWorkspaceContent,
} from "src/libs/profileWorkspace"
import {
  computeProfileDirtyMask,
  toPayloadLinks,
  validateLinkInputs,
  type WorkspaceSectionId,
  type LinkTab,
} from "./AdminProfileWorkspaceModel"
import type { NoticeTone } from "./AdminProfileWorkspacePageModel"

export type ProfileWorkspaceDirtyState = {
  normalizedDraft: ProfileWorkspaceContent
  normalizedRemoteDraft: ProfileWorkspaceContent
  normalizedPublished: ProfileWorkspaceContent
  draftDirtyMask: number
  publishedDirtyMask: number
  hasWorkspaceUnsavedChanges: boolean
  hasDisplayNameDirty: boolean
  hasUnsavedChanges: boolean
  hasPublishedDiff: boolean
  sectionStateMap: Record<WorkspaceSectionId, { dirty: boolean; publishedDiff: boolean }>
}

export const computeWorkspaceDirtyState = (
  draft: ProfileWorkspaceContent,
  remoteDraft: ProfileWorkspaceContent,
  publishedSnapshot: ProfileWorkspaceContent,
  sessionMemberDisplayName: string,
  displayNameInput: string
): ProfileWorkspaceDirtyState => {
  const normalizedDraft = normalizeProfileWorkspaceContent(draft)
  const normalizedRemoteDraft = normalizeProfileWorkspaceContent(remoteDraft)
  const normalizedPublished = normalizeProfileWorkspaceContent(publishedSnapshot)

  const draftDirtyMask = computeProfileDirtyMask(normalizedDraft, normalizedRemoteDraft)
  const publishedDirtyMask = computeProfileDirtyMask(normalizedRemoteDraft, normalizedPublished)

  const hasWorkspaceUnsavedChanges =
    draftDirtyMask !== 0 ||
    normalizedDraft.blogDesign !== normalizedRemoteDraft.blogDesign ||
    normalizedDraft.legacyBlogScheme !== normalizedRemoteDraft.legacyBlogScheme

  const hasDisplayNameDirty = displayNameInput.trim() !== sessionMemberDisplayName.trim()
  const hasUnsavedChanges = hasDisplayNameDirty || hasWorkspaceUnsavedChanges

  const hasPublishedDiff =
    publishedDirtyMask !== 0 ||
    normalizedRemoteDraft.blogDesign !== normalizedPublished.blogDesign ||
    normalizedRemoteDraft.legacyBlogScheme !== normalizedPublished.legacyBlogScheme

  const sectionStateMap: Record<WorkspaceSectionId, { dirty: boolean; publishedDiff: boolean }> = {
    identity: {
      dirty: hasDisplayNameDirty || (draftDirtyMask & 1) !== 0,
      publishedDiff: (publishedDirtyMask & 1) !== 0,
    },
    about: {
      dirty: (draftDirtyMask & 2) !== 0,
      publishedDiff: (publishedDirtyMask & 2) !== 0,
    },
    home: {
      dirty: (draftDirtyMask & 4) !== 0,
      publishedDiff: (publishedDirtyMask & 4) !== 0,
    },
    links: {
      dirty: (draftDirtyMask & 8) !== 0,
      publishedDiff: (publishedDirtyMask & 8) !== 0,
    },
  }

  return {
    normalizedDraft,
    normalizedRemoteDraft,
    normalizedPublished,
    draftDirtyMask,
    publishedDirtyMask,
    hasWorkspaceUnsavedChanges,
    hasDisplayNameDirty,
    hasUnsavedChanges,
    hasPublishedDiff,
    sectionStateMap,
  }
}

export const validateProfileDraftBeforePersistence = (
  draft: ProfileWorkspaceContent,
  displayNameInput: string,
  hasDisplayNameDirty: boolean,
  setWorkspaceNotice: (notice: { tone: NoticeTone; text: string }) => void,
  setActiveSection: (sec: WorkspaceSectionId) => void,
  setLinkTab: (tab: LinkTab) => void
): boolean => {
  const serviceValidationError = validateLinkInputs("service", "서비스", draft.serviceLinks)
  if (serviceValidationError) {
    setWorkspaceNotice({ tone: "error", text: serviceValidationError })
    setActiveSection("links")
    setLinkTab("service")
    return false
  }

  const contactValidationError = validateLinkInputs("contact", "연락 채널", draft.contactLinks)
  if (contactValidationError) {
    setWorkspaceNotice({ tone: "error", text: contactValidationError })
    setActiveSection("links")
    setLinkTab("contact")
    return false
  }

  const normalizedDisplayName = displayNameInput.trim()
  if (hasDisplayNameDirty && (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 30)) {
    setWorkspaceNotice({ tone: "error", text: "계정 이름은 2자 이상 30자 이하로 입력해주세요." })
    setActiveSection("identity")
    return false
  }

  return true
}

export const buildProfileDraftPayload = (draft: ProfileWorkspaceContent): ProfileWorkspaceContent =>
  normalizeProfileWorkspaceContent({
    ...draft,
    serviceLinks: toPayloadLinks("service", draft.serviceLinks),
    contactLinks: toPayloadLinks("contact", draft.contactLinks),
  })
