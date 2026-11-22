/**
 * 참조 구현:
 * - emilkowalski/sonner & shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/sonner.tsx, MIT License)
 * - lucide-icons/lucide (icons/{circle-check,circle-alert,info}.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import styled from "@emotion/styled"
import { type ReactNode } from "react"
import { useLanguage } from "src/libs/language"
import { focusVisibleRing } from "./focusRing"
import { fixedBottomSafeArea, fixedHorizontalSafeArea } from "./safeArea"
import { boxShadowColor, layoutBreakpoint, radius, semanticColors, space } from "./tokens"

export type ToastTone = "neutral" | "success" | "danger"

export type ToastProps = {
  message: string
  tone?: ToastTone
  open: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  actions?: ReactNode
  zIndex?: number
}

const ToneIcon: React.FC<{ tone: ToastTone }> = ({ tone }) => (
  <svg
    className="toastIcon"
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {tone === "success" ? (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </>
    ) : tone === "danger" ? (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    )}
  </svg>
)

export const Toast = ({
  message,
  tone = "neutral",
  open,
  onOpenChange,
  title,
  actions,
  zIndex = 40,
}: ToastProps) => {
  const { t } = useLanguage()
  if (!open) return null

  const showActions = Boolean(actions) || Boolean(onOpenChange)
  const isDanger = tone === "danger"

  return (
    <ToastViewport
      data-tone={tone}
      role={isDanger ? "alert" : "status"}
      aria-live={isDanger ? "assertive" : "polite"}
      $zIndex={zIndex}
    >
      <div className="copy">
        <ToneIcon tone={tone} />
        <div className="text">
          {title ? <strong>{title}</strong> : null}
          <span>{message}</span>
        </div>
      </div>
      {showActions ? (
        <div className="actions">
          {actions}
          {onOpenChange ? (
            <DismissButton type="button" onClick={() => onOpenChange(false)}>
              {t("toastDismiss")}
            </DismissButton>
          ) : null}
        </div>
      ) : null}
    </ToastViewport>
  )
}

const toneColor = (tone: ToastTone, theme: Parameters<typeof semanticColors>[0]) => {
  const colors = semanticColors(theme)
  if (tone === "success") return colors.dotSuccess
  if (tone === "danger") return colors.dotDanger
  return colors.dotNeutral
}

const ToastViewport = styled.div<{ "data-tone": ToastTone; $zIndex: number }>`
  position: fixed;
  right: 1.25rem;
  ${fixedBottomSafeArea("1.25rem")}
  z-index: ${({ $zIndex }) => $zIndex};
  display: grid;
  gap: ${space[3]}px;
  min-width: min(22rem, calc(100vw - 2rem));
  max-width: min(26rem, calc(100vw - 2rem));
  padding: ${space[4]}px;
  border-radius: ${radius.lg}px;
  border: 1px solid ${({ theme }) => semanticColors(theme).border};
  background: ${({ theme }) => semanticColors(theme).surface};
  color: ${({ theme }) => semanticColors(theme).textPrimary};
  box-shadow: 0 4px 12px ${boxShadowColor.cardFloating};

  .copy {
    display: flex;
    align-items: flex-start;
    gap: ${space[3]}px;
    min-width: 0;
  }

  .toastIcon {
    margin-top: 0.1rem;
    flex: 0 0 auto;
    color: ${({ theme, "data-tone": tone }) => toneColor(tone, theme)};
  }

  .text {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .text strong {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    color: ${({ theme }) => semanticColors(theme).textPrimary};
  }

  .text span {
    color: ${({ theme }) => semanticColors(theme).textSecondary};
    font-size: 0.84rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;

    button,
    a {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    @media (max-width: ${layoutBreakpoint.editorCompact}px), (pointer: coarse) {
      button,
      a {
        min-width: 44px;
        min-height: 44px;
      }
    }
  }

  @media (max-width: ${layoutBreakpoint.editorCompact}px) {
    ${fixedHorizontalSafeArea("0.85rem")}
    ${fixedBottomSafeArea("0.85rem")}
    min-width: 0;
    max-width: none;
  }
`

const DismissButton = styled.button`
  border: 0;
  background: transparent;
  color: ${({ theme }) => semanticColors(theme).textSecondary};
  padding: 0;
  min-width: 44px;
  min-height: 44px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${({ theme }) => semanticColors(theme).textPrimary};
  }
`
