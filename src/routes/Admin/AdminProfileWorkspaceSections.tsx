// 참조 구현: TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { clampProfileImageEditZoom } from "src/libs/profileImageUpload"
import AdminShell from "src/routes/Admin/AdminShell"
import {
  DockPrimaryButton,
  DockSecondaryButton,
  EditorColumn,
  EditorPaneHeader,
  EditorSurface,
  Main,
  SectionRail,
  SectionRailButton,
  SectionStateBadge,
  SettingsHeaderActions,
  SettingsHeaderTitleGroup,
  SettingsSideRail,
  SyncStateBadge,
  ToastCard,
  ToastStack,
  WorkspaceHero,
  WorkspaceShell,
} from "src/routes/Admin/AdminProfileWorkspace.styles"
import { normalizeProfileWorkspaceDraftSafe } from "src/routes/Admin/AdminProfilePersistenceModel"
import { WORKSPACE_SECTIONS } from "src/routes/Admin/AdminProfileWorkspaceModel"
import type { AdminProfileWorkspaceSectionProps } from "src/routes/Admin/AdminProfileWorkspacePageModel"
import AdminProfileImageEditorModal from "src/routes/Admin/AdminProfileImageEditorModal"
import { renderAdminProfileWorkspaceSection } from "src/routes/Admin/AdminProfileWorkspaceSectionRenderer"

type AdminProfileWorkspaceSectionsViewProps = AdminProfileWorkspaceSectionProps & {
  onDiscardChanges?: () => void
}

export const AdminProfileWorkspaceSections = (props: AdminProfileWorkspaceSectionsViewProps) => {
  const {
    activeSection,
    displayNameInput,
    draft: rawDraft,
    finalizeProfileImageDraftPointer,
    handleApplyProfileImageDraft,
    handleDraftFileChange,
    handleDeletePreviousProfileImage,
    handleProfileImageDraftPointerDown,
    handleProfileImageDraftPointerMove,
    handlePublish,
    handleSaveDraft,
    handleSelectPreviousProfileImage,
    hasPublishedDiff,
    hasUnsavedChanges,
    imageNotice,
    initialProfileSnapshot,
    isProfileImageDraftDragging,
    isProfileImageEditorOpen,
    loadingKey,
    onDiscardChanges,
    profileImageDraftFile,
    profileImageDraftFrameRef,
    profileImageDraftNotice,
    profileImageDraftPreviewUrl,
    profileImageDraftTransformRef,
    profileImageDraftZoom,
    profileImageFileInputRef,
    previousProfileImages,
    publishedSnapshot: rawPublishedSnapshot,
    resetProfileImageDraftInteractions,
    scheduleProfileImageDraftTransform,
    sectionStateMap,
    sessionMember,
    setActiveSection,
    setIsProfileImageEditorOpen,
    workspaceNotice,
    clearProfileImageDraft,
  } = props

  const draft = normalizeProfileWorkspaceDraftSafe(rawDraft)
  const publishedSnapshot = normalizeProfileWorkspaceDraftSafe(rawPublishedSnapshot)
  const missingExposureItems: string[] = []
  if (!(displayNameInput ?? "").trim()) missingExposureItems.push("계정 이름")
  if (!draft.profileBio.trim()) missingExposureItems.push("짧은 소개")
  if (!draft.aboutHeadline.trim() || !draft.aboutRole.trim() || !draft.aboutBio.trim()) missingExposureItems.push("About 소개")
  if (!draft.aboutProjectSectionTitle.trim() || draft.aboutProjects.length === 0) missingExposureItems.push("About 프로젝트")
  if (!draft.homeIntroTitle.trim() || !draft.homeIntroDescription.trim()) missingExposureItems.push("메인 헤더 카피")
  const hasMissingExposureItems = missingExposureItems.length > 0
  const activeSectionMeta = WORKSPACE_SECTIONS.find((section) => section.id === activeSection) || WORKSPACE_SECTIONS[0]
  const pageToasts = [workspaceNotice, imageNotice].filter(
    (notice) => notice.tone !== "idle" && notice.text.trim().length > 0
  )
  const isSavingDraft = loadingKey === "save"
  const isPublishing = loadingKey === "publish"
  const isPersisting = isPublishing || isSavingDraft
  const canPublish = (hasUnsavedChanges || hasPublishedDiff) && !isPersisting
  const canSave = hasUnsavedChanges && !isPersisting
  const canDiscard = Boolean(onDiscardChanges) && hasUnsavedChanges && !isPersisting
  const publishActionLabel =
    isPublishing ? "공개 적용 중..." : hasUnsavedChanges ? "저장 후 공개 적용" : "공개 적용"
  const activeSectionState = sectionStateMap[activeSection]
  const isSaveBarElevated = hasUnsavedChanges || hasPublishedDiff
  const headerSyncText = isSaveBarElevated ? "미저장 변경 있음" : "변경 사항 동기화됨"

  const handleSectionRailKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const count = WORKSPACE_SECTIONS.length
    if (count === 0) return
    const currentIndex = Math.max(0, WORKSPACE_SECTIONS.findIndex((s) => s.id === activeSection))
    let nextIndex = -1

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % count
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + count) % count
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = count - 1
    }

    if (nextIndex === -1) return
    event.preventDefault()
    const targetSection = WORKSPACE_SECTIONS[nextIndex]
    if (!targetSection) return
    setActiveSection(targetSection.id)
    const tabElements = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabElements[nextIndex]?.focus()
  }

  return (
    <AdminShell
      currentSection="profile"
      member={sessionMember}
      profileSnapshot={initialProfileSnapshot}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <Main>
        <input
          ref={profileImageFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleDraftFileChange}
        />

        <WorkspaceHero>
          <SettingsHeaderTitleGroup>
            <h1>개인정보와 계정 설정</h1>
            <SyncStateBadge data-tone={isSaveBarElevated ? "dirty" : "synced"}>
              {headerSyncText}
            </SyncStateBadge>
          </SettingsHeaderTitleGroup>
          <SettingsHeaderActions>
            {onDiscardChanges ? (
              <DockSecondaryButton
                type="button"
                disabled={!canDiscard}
                onClick={onDiscardChanges}
              >
                변경사항 되돌리기
              </DockSecondaryButton>
            ) : null}
            <DockSecondaryButton
              type="button"
              disabled={!canSave}
              onClick={() => void handleSaveDraft()}
            >
              {loadingKey === "save" ? "저장 중..." : "초안 저장"}
            </DockSecondaryButton>
            <DockPrimaryButton
              type="button"
              disabled={!canPublish}
              onClick={() => void handlePublish()}
            >
              {publishActionLabel}
            </DockPrimaryButton>
          </SettingsHeaderActions>
        </WorkspaceHero>

        <WorkspaceShell>
          <SettingsSideRail>
            <SectionRail role="tablist" aria-label="프로필 섹션" onKeyDown={handleSectionRailKeyDown}>
              {WORKSPACE_SECTIONS.map((section) => (
                <SectionRailButton
                  key={section.id}
                  type="button"
                  role="tab"
                  tabIndex={activeSection === section.id ? 0 : -1}
                  aria-selected={activeSection === section.id}
                  data-active={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span>{section.label}</span>
                </SectionRailButton>
              ))}
            </SectionRail>
          </SettingsSideRail>

          <EditorColumn>
            <EditorSurface>
              <EditorPaneHeader>
                <div className="titleRow">
                  <h2>{activeSectionMeta.label}</h2>
                  {activeSectionState.dirty ? (
                    <SectionStateBadge data-tone="dirty">저장 안 됨</SectionStateBadge>
                  ) : activeSectionState.publishedDiff ? (
                    <SectionStateBadge data-tone="published">공개본과 차이 있음</SectionStateBadge>
                  ) : null}
                </div>
                <p>변경 사항은 초안 저장 후 공개 적용으로 블로그와 About 페이지에 반영됩니다.</p>
                {hasMissingExposureItems ? (
                  <p className="exposureMissingHint">
                    미입력 공개 항목: {missingExposureItems.join(" · ")}
                  </p>
                ) : null}
              </EditorPaneHeader>
              {renderAdminProfileWorkspaceSection({
                ...props,
                draft,
                publishedSnapshot,
              })}
            </EditorSurface>
          </EditorColumn>
        </WorkspaceShell>

        {pageToasts.length > 0 ? (
          <ToastStack role="status" aria-live="polite">
            {pageToasts.map((notice, index) => (
              <ToastCard key={`${notice.tone}-${index}-${notice.text}`} data-tone={notice.tone}>
                {notice.text}
              </ToastCard>
            ))}
          </ToastStack>
        ) : null}

        {isProfileImageEditorOpen ? (
          <AdminProfileImageEditorModal
            frameRef={profileImageDraftFrameRef}
            hasDraftFile={Boolean(profileImageDraftFile)}
            isDragging={isProfileImageDraftDragging}
            isUploading={loadingKey === "upload"}
            notice={profileImageDraftNotice}
            onApply={() => void handleApplyProfileImageDraft()}
            onClear={clearProfileImageDraft}
            onDeletePreviousProfileImage={handleDeletePreviousProfileImage}
            onPointerCancel={finalizeProfileImageDraftPointer}
            onPointerDown={handleProfileImageDraftPointerDown}
            onPointerMove={handleProfileImageDraftPointerMove}
            onPointerUp={finalizeProfileImageDraftPointer}
            onRequestClose={() => {
              setIsProfileImageEditorOpen(false)
              resetProfileImageDraftInteractions()
            }}
            onSelectPreviousProfileImage={handleSelectPreviousProfileImage}
            onSelectFile={() => profileImageFileInputRef.current?.click()}
            previousProfileImages={previousProfileImages}
            onZoomChange={(zoom) =>
              scheduleProfileImageDraftTransform({
                ...profileImageDraftTransformRef.current,
                zoom: clampProfileImageEditZoom(zoom),
              })
            }
            onMoveOffset={({ deltaX, deltaY }) => {
              const frame = profileImageDraftFrameRef.current
              const width = frame?.clientWidth || 320
              const height = frame?.clientHeight || 320
              const current = profileImageDraftTransformRef.current
              const zoomScale = Math.max(current.zoom, 1)
              scheduleProfileImageDraftTransform({
                focusX: current.focusX - (deltaX / width) * (100 / zoomScale),
                focusY: current.focusY - (deltaY / height) * (100 / zoomScale),
                zoom: current.zoom,
              })
            }}
            previewUrl={profileImageDraftPreviewUrl}
            zoom={profileImageDraftZoom}
          />
        ) : null}
      </Main>
    </AdminShell>
  )
}
