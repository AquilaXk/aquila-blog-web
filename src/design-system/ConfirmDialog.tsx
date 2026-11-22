/**
 * 참조 구현:
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/alert-dialog.tsx, MIT License, Copyright (c) 2023 shadcn)
 */
import type { Theme } from "@emotion/react"
import styled from "@emotion/styled"
import { useRef, type ReactNode } from "react"
import { useLanguage } from "src/libs/language"
import { zIndexes } from "src/styles/zIndexes"
import { focusVisibleRing } from "./focusRing"
import { modalSafeAreaPadding } from "./safeArea"
import { boxShadowColor } from "./tokens"
import { useModalFocusTrap } from "./useModalFocusTrap"

export type ConfirmDialogTone = "default" | "danger"

export type ConfirmDialogProps = {
  open: boolean
  titleId: string
  descriptionId: string
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmTone?: ConfirmDialogTone
  actionRowBackground?: (theme: Theme) => string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  open,
  titleId,
  descriptionId,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmTone = "danger",
  actionRowBackground,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const { t } = useLanguage()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const resolvedCancelLabel = cancelLabel ?? t("dialogCancel")

  const { handleKeyDown } = useModalFocusTrap({
    open,
    onClose: onCancel,
    containerRef: dialogRef,
    initialFocusRef: cancelButtonRef,
    lockScroll: true,
  })

  if (!open) return null

  return (
    <ConfirmBackdrop role="presentation" onClick={onCancel}>
      <ConfirmPanel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <strong id={titleId}>{title}</strong>
        <Description id={descriptionId}>{description}</Description>
        <ActionRow $actionRowBackground={actionRowBackground}>
          <GhostButton ref={cancelButtonRef} type="button" onClick={onCancel}>
            {resolvedCancelLabel}
          </GhostButton>
          <ConfirmButton type="button" data-tone={confirmTone} onClick={onConfirm}>
            {confirmLabel}
          </ConfirmButton>
        </ActionRow>
      </ConfirmPanel>
    </ConfirmBackdrop>
  )
}

const ConfirmBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.confirmDialog};
  display: grid;
  place-items: center;
  ${modalSafeAreaPadding}
  background: color-mix(in srgb, ${({ theme }) => theme.colors.gray12} 42%, transparent);
`

const ConfirmPanel = styled.div`
  width: min(28rem, 100%);
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  background: ${({ theme }) => theme.colors.gray1};
  box-shadow: 0 10px 28px ${boxShadowColor.modalElevated};

  > strong {
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: ${({ theme }) => theme.colors.gray12};
  }
`

const Description = styled.p`
  margin: 0;
  display: grid;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.gray10};
  line-height: 1.55;

  .rowTitle {
    color: ${({ theme }) => theme.colors.gray12};
    font-weight: 700;
  }
`

const ActionRow = styled.div<{ $actionRowBackground?: (theme: Theme) => string }>`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  width: 100%;
  padding-top: 0.25rem;
  background: ${({ theme, $actionRowBackground }) =>
    $actionRowBackground ? $actionRowBackground(theme) : "transparent"};
`

const GhostButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  background: ${({ theme }) => theme.colors.gray1};
  color: ${({ theme }) => theme.colors.gray12};
  min-height: 40px;
  padding: 0 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  ${focusVisibleRing}

  &:hover {
    background: ${({ theme }) => theme.colors.gray3};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
  }
`

const ConfirmButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.gray12};
  background: ${({ theme }) => theme.colors.gray12};
  color: ${({ theme }) => theme.colors.gray1};
  min-height: 40px;
  padding: 0 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.15s ease;
  ${focusVisibleRing}

  &:hover {
    opacity: 0.9;
  }

  &[data-tone="danger"] {
    border-color: ${({ theme }) => theme.colors.statusDangerBorder};
    background: ${({ theme }) => theme.colors.statusDangerText};
    color: ${({ theme }) => theme.colors.gray1};

    &:hover {
      opacity: 0.92;
    }
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
  }
`
