// 클라우드 워크스페이스 모달·컨텍스트 메뉴·벌크 바·라이트박스·토스트 오버레이 묶음
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject, SetStateAction } from "react"
import type { CloudFile } from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import { AdminCloudMediaLightbox } from "../AdminCloudMediaLightbox"
import { CloudDeleteConfirmDialog } from "../AdminCloudPreviewDrawer"
import { ToastViewport } from "../AdminCloudWorkspace.styles"
import type { CloudToastState } from "../useAdminCloudWorkspaceActions"
import { getCloudDictionary } from "./adminCloudI18n"
import { CloudContextMenu, type CloudContextMenuState } from "./CloudContextMenu"
import { CloudFloatingBulkBar } from "./CloudFloatingBulkBar"
import {
  CloudMoveItemsModal,
  CloudNewFolderModal,
  CloudRenameFileModal,
} from "./CloudFolderModals"
import { normalizeCloudFolderPath } from "./cloudFolderHelpers"
import { CloudShareLinkModal } from "./CloudShareLinkModal"

export type CloudWorkspaceOverlaysProps = {
  checkedCount: number
  isBusy: boolean
  activeFolderPath: string
  allFolders: string[]
  files: CloudFile[]
  contextMenu: CloudContextMenuState
  newFolderModalOpen: boolean
  moveTargets: CloudFile[] | null
  renameTarget: CloudFile | null
  shareTarget: CloudFile | null
  lightboxFile: CloudFile | null
  toast: CloudToastState
  deleteConfirm: { files: CloudFile[] } | null
  isDeletePending: boolean
  deleteDialogRef: RefObject<HTMLDivElement | null>
  deleteCancelButtonRef: RefObject<HTMLButtonElement | null>
  onCloseContextMenu: () => void
  onCloseNewFolder: () => void
  onCloseMove: () => void
  onCloseRename: () => void
  onCloseShare: () => void
  onCloseLightbox: () => void
  onCloseDelete: () => void
  onClearToast: () => void
  onOpenBulkMove: () => void
  onBulkDownload: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
  onOpenLightbox: (fileId: number) => void
  onSelectFile: (fileId: number) => void
  onOpenRename: (file: CloudFile) => void
  onOpenMove: (files: CloudFile[]) => void
  onOpenShare: (file: CloudFile) => void
  onDownloadFile: (file: CloudFile) => void
  onRequestDeleteFile: (file: CloudFile) => void
  onCreateFolder: (folderPath: string) => void
  onMoveFiles: (files: CloudFile[], targetFolderPath: string) => Promise<boolean>
  onUpdateFile: (
    fileId: number,
    payload: { originalFilename: string; folderPath: string }
  ) => Promise<boolean>
  onCopyFileLink: (file: CloudFile) => Promise<void>
  onConfirmDelete: () => void
  onDeleteDialogKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onToast: Dispatch<SetStateAction<CloudToastState>>
}

export const CloudWorkspaceModalsAndOverlays = ({
  checkedCount,
  isBusy,
  activeFolderPath,
  allFolders,
  files,
  contextMenu,
  newFolderModalOpen,
  moveTargets,
  renameTarget,
  shareTarget,
  lightboxFile,
  toast,
  deleteConfirm,
  isDeletePending,
  deleteDialogRef,
  deleteCancelButtonRef,
  onCloseContextMenu,
  onCloseNewFolder,
  onCloseMove,
  onCloseRename,
  onCloseShare,
  onCloseLightbox,
  onCloseDelete,
  onClearToast,
  onOpenBulkMove,
  onBulkDownload,
  onBulkDelete,
  onClearSelection,
  onOpenLightbox,
  onSelectFile,
  onOpenRename,
  onOpenMove,
  onOpenShare,
  onDownloadFile,
  onRequestDeleteFile,
  onCreateFolder,
  onMoveFiles,
  onUpdateFile,
  onCopyFileLink,
  onConfirmDelete,
  onDeleteDialogKeyDown,
  onToast,
}: CloudWorkspaceOverlaysProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"

  return (
    <>
      <CloudFloatingBulkBar
        selectedCount={checkedCount}
        isBusy={isBusy}
        onBulkMove={onOpenBulkMove}
        onBulkDownload={onBulkDownload}
        onBulkDelete={onBulkDelete}
        onClearSelection={onClearSelection}
      />

      <CloudContextMenu
        state={contextMenu}
        onClose={onCloseContextMenu}
        onPreview={(file) => onOpenLightbox(file.id)}
        onRename={onOpenRename}
        onMove={(file) => onOpenMove([file])}
        onShare={onOpenShare}
        onDownload={onDownloadFile}
        onDelete={onRequestDeleteFile}
      />

      <CloudNewFolderModal
        open={newFolderModalOpen}
        activeFolderPath={activeFolderPath}
        onClose={onCloseNewFolder}
        onSubmit={onCreateFolder}
      />

      <CloudMoveItemsModal
        open={moveTargets !== null}
        fileCount={moveTargets?.length ?? 0}
        initialFolderPath={
          moveTargets && moveTargets.length === 1
            ? normalizeCloudFolderPath(moveTargets[0]?.folderPath || "")
            : activeFolderPath
        }
        availableFolders={allFolders}
        isBusy={isBusy}
        onClose={onCloseMove}
        onConfirm={async (targetFolder) => {
          if (!moveTargets) return
          const ok = await onMoveFiles(moveTargets, targetFolder)
          if (ok) onCloseMove()
        }}
      />

      <CloudRenameFileModal
        open={renameTarget !== null}
        initialFilename={renameTarget?.originalFilename || ""}
        isBusy={isBusy}
        onClose={onCloseRename}
        onConfirm={async (nextName) => {
          if (!renameTarget) return
          const ok = await onUpdateFile(renameTarget.id, {
            originalFilename: nextName,
            folderPath: normalizeCloudFolderPath(renameTarget.folderPath || ""),
          })
          if (ok) onCloseRename()
        }}
      />

      <CloudShareLinkModal
        open={shareTarget !== null}
        file={shareTarget}
        onClose={onCloseShare}
        onToast={onToast}
      />

      <AdminCloudMediaLightbox
        open={lightboxFile !== null}
        file={lightboxFile}
        files={files}
        onClose={onCloseLightbox}
        onSelectFile={(nextId) => {
          onOpenLightbox(nextId)
          onSelectFile(nextId)
        }}
        onCopyFileLink={onCopyFileLink}
      />

      {toast ? (
        <ToastViewport data-tone={toast.tone} role="status" aria-live="polite">
          <strong>
            {toast.tone === "error"
              ? isEn
                ? "Action failed"
                : "작업 실패"
              : isEn
                ? "Done"
                : "작업 완료"}
          </strong>
          <span>{toast.text}</span>
          <button type="button" onClick={onClearToast}>
            {t.close}
          </button>
        </ToastViewport>
      ) : null}

      {deleteConfirm ? (
        <CloudDeleteConfirmDialog
          files={deleteConfirm.files}
          isDeletePending={isDeletePending}
          deleteDialogRef={deleteDialogRef}
          deleteCancelButtonRef={deleteCancelButtonRef}
          onClose={onCloseDelete}
          onConfirm={onConfirmDelete}
          onKeyDown={onDeleteDialogKeyDown}
        />
      ) : null}
    </>
  )
}
