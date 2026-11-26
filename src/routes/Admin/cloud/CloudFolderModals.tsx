// 참조 구현: supabase/supabase StorageExplorer MoveItemsModal (Apache-2.0) — 새 폴더·이름 변경·폴더 이동 접근성 모달
import { useEffect, useRef, useState } from "react"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import { PrimaryButton, SecondaryButton } from "../AdminCloudWorkspaceControls.styles"
import {
  CloudModalBackdrop,
  CloudModalCard,
  ModalInput,
  ModalPillButton,
  ModalSegmentedRow,
} from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"
import { validateCloudFolderPath } from "./cloudFolderHelpers"

export const CloudNewFolderModal = ({
  open,
  activeFolderPath,
  onClose,
  onSubmit,
}: {
  open: boolean
  activeFolderPath: string
  onClose: () => void
  onSubmit: (folderPath: string) => void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [value, setValue] = useState("")
  const [errorText, setErrorText] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleKeyDown } = useModalFocusTrap({
    open,
    onClose,
    containerRef,
    initialFocusRef: inputRef,
  })

  useEffect(() => {
    if (open) {
      setValue(activeFolderPath ? `${activeFolderPath}/` : "")
      setErrorText("")
    }
  }, [activeFolderPath, open])

  if (!open) return null

  return (
    <CloudModalBackdrop onClick={onClose}>
      <CloudModalCard
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-new-folder-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="cloud-new-folder-title">{t.newFolderTitle}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const check = validateCloudFolderPath(value)
            if (!check.ok || !check.path) {
              setErrorText(t.newFolderInvalid)
              return
            }
            onSubmit(check.path)
            onClose()
          }}
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 650 }}>
            <span>{t.newFolderLabel}</span>
            <ModalInput
              ref={inputRef}
              type="text"
              placeholder={t.newFolderPlaceholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setErrorText("")
              }}
            />
          </label>
          {errorText ? (
            <p role="alert" style={{ margin: 0, fontSize: "0.76rem" }}>
              {errorText}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.45rem" }}>
            <SecondaryButton type="button" onClick={onClose}>
              {t.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">{t.newFolderConfirm}</PrimaryButton>
          </div>
        </form>
      </CloudModalCard>
    </CloudModalBackdrop>
  )
}

export const CloudMoveItemsModal = ({
  open,
  fileCount,
  initialFolderPath,
  availableFolders,
  isBusy,
  onClose,
  onConfirm,
}: {
  open: boolean
  fileCount: number
  initialFolderPath: string
  availableFolders: string[]
  isBusy: boolean
  onClose: () => void
  onConfirm: (targetFolderPath: string) => Promise<void> | void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [targetFolder, setTargetFolder] = useState("")
  const [errorText, setErrorText] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleKeyDown } = useModalFocusTrap({
    open,
    onClose,
    containerRef,
    initialFocusRef: inputRef,
  })

  useEffect(() => {
    if (open) {
      setTargetFolder(initialFolderPath)
      setErrorText("")
    }
  }, [initialFolderPath, open])

  if (!open) return null

  return (
    <CloudModalBackdrop onClick={isBusy ? undefined : onClose}>
      <CloudModalCard
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-move-items-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="cloud-move-items-title">{t.moveModalTitle(fileCount)}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const check = validateCloudFolderPath(targetFolder)
            if (!check.ok) {
              setErrorText(t.newFolderInvalid)
              return
            }
            await onConfirm(check.path)
          }}
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <ModalSegmentedRow aria-label={language === "en" ? "Quick folder choices" : "폴더 빠른 선택"}>
            <ModalPillButton
              type="button"
              data-active={targetFolder.trim() === ""}
              onClick={() => setTargetFolder("")}
            >
              {t.rootFolder}
            </ModalPillButton>
            {availableFolders.map((folder) => (
              <ModalPillButton
                key={folder}
                type="button"
                data-active={targetFolder.trim() === folder}
                onClick={() => setTargetFolder(folder)}
              >
                /{folder}
              </ModalPillButton>
            ))}
          </ModalSegmentedRow>

          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 650 }}>
            <span>{t.moveTargetLabel}</span>
            <ModalInput
              ref={inputRef}
              type="text"
              placeholder={t.moveCustomPlaceholder}
              value={targetFolder}
              onChange={(e) => {
                setTargetFolder(e.target.value)
                setErrorText("")
              }}
            />
          </label>
          {errorText ? (
            <p role="alert" style={{ margin: 0, fontSize: "0.76rem" }}>
              {errorText}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.45rem" }}>
            <SecondaryButton type="button" disabled={isBusy} onClick={onClose}>
              {t.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={isBusy}>
              {t.moveConfirm}
            </PrimaryButton>
          </div>
        </form>
      </CloudModalCard>
    </CloudModalBackdrop>
  )
}

export const CloudRenameFileModal = ({
  open,
  initialFilename,
  isBusy,
  onClose,
  onConfirm,
}: {
  open: boolean
  initialFilename: string
  isBusy: boolean
  onClose: () => void
  onConfirm: (nextFilename: string) => Promise<void> | void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [filename, setFilename] = useState(initialFilename)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleKeyDown } = useModalFocusTrap({
    open,
    onClose,
    containerRef,
    initialFocusRef: inputRef,
  })

  useEffect(() => {
    if (open) setFilename(initialFilename)
  }, [initialFilename, open])

  if (!open) return null

  return (
    <CloudModalBackdrop onClick={isBusy ? undefined : onClose}>
      <CloudModalCard
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-rename-file-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="cloud-rename-file-title">{t.renameModalTitle}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed = filename.trim()
            if (!trimmed) return
            await onConfirm(trimmed)
          }}
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 650 }}>
            <span>{t.renameInputLabel}</span>
            <ModalInput
              ref={inputRef}
              type="text"
              value={filename}
              maxLength={255}
              onChange={(e) => setFilename(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.45rem" }}>
            <SecondaryButton type="button" disabled={isBusy} onClick={onClose}>
              {t.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={isBusy || !filename.trim()}>
              {t.renameConfirm}
            </PrimaryButton>
          </div>
        </form>
      </CloudModalCard>
    </CloudModalBackdrop>
  )
}
