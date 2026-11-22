/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (app/not-found.tsx, MIT License)
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/empty.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { type HTMLAttributes, type ReactNode } from "react"
import { focusVisibleRing } from "./focusRing"
import { boxShadowColor, editorialLabel, semanticColors } from "./tokens"
import { duration, easing, respectReducedMotion } from "./motion"

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: string
  height?: string
}

export const Skeleton = ({
  width = "100%",
  height = "1rem",
  ...props
}: SkeletonProps) => <SkeletonBlock style={{ width, height }} {...props} />

const skeletonPulse = `
  @keyframes aq-skeleton-pulse {
    0%, 100% {
      opacity: 0.65;
    }
    50% {
      opacity: 1;
    }
  }
`

export const skeletonShimmerCss = `
  background: var(--aq-surface-subtle);
  animation: aq-skeleton-pulse ${duration.skeleton}ms ${easing.standard} infinite;
  ${skeletonPulse}
  ${respectReducedMotion}
`

export const SkeletonBlock = styled.div`
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray3};
  animation: aq-skeleton-pulse ${duration.skeleton}ms ${easing.standard} infinite;
  ${skeletonPulse}
  ${respectReducedMotion}
`

export type ErrorStateProps = {
  label: string
  title: string
  description: string
  meta?: string
  actions?: ReactNode
  "data-error-boundary"?: string
}

export const ErrorState = ({
  label,
  title,
  description,
  meta,
  actions,
  "data-error-boundary": dataErrorBoundary,
}: ErrorStateProps) => {
  const isNumericCode = /^\d{3}$/.test(label.trim())

  return (
    <ErrorStateShell data-error-boundary={dataErrorBoundary}>
      <div className="shell">
        <div className="codeWrap">
          <div className={isNumericCode ? "statusCode" : "statusText"} aria-hidden="true">
            {label}
          </div>
        </div>
        <div className="copy">
          <h1>{title}</h1>
          <p>{description}</p>
          {meta ? <span className="meta">{meta}</span> : null}
          {actions ? <div className="actions">{actions}</div> : null}
        </div>
      </div>
    </ErrorStateShell>
  )
}

const ErrorStateShell = styled.section`
  display: block;
  min-height: min(64vh, 36rem);
  padding: clamp(2rem, 6vw, 4rem) 0;
  color: ${({ theme }) => theme.colors.gray12};

  .shell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;

    @media (min-width: 768px) {
      margin-top: 6rem;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
    }
  }

  .codeWrap {
    padding-top: 1.5rem;
    padding-bottom: 2rem;

    @media (min-width: 768px) {
      padding-top: 0;
      padding-bottom: 0;
    }
  }

  .statusCode {
    margin: 0;
    font-size: 3.75rem;
    line-height: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: ${({ theme }) => theme.colors.gray12};

    @media (min-width: 768px) {
      border-right: 2px solid ${({ theme }) => theme.publicDesign.border};
      padding-right: 1.5rem;
      font-size: 6rem;
      line-height: 3.5rem;
    }
  }

  .statusText {
    font-family: ${editorialLabel.fontFamily};
    font-size: 1.25rem;
    line-height: 1.3;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.gray11};

    @media (min-width: 768px) {
      border-right: 2px solid ${({ theme }) => theme.publicDesign.border};
      padding-right: 1.5rem;
      font-size: 1.5rem;
    }
  }

  .copy {
    max-width: 28rem;
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    line-height: 1.5;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.gray12};

    @media (min-width: 768px) {
      font-size: 1.5rem;
    }
  }

  p {
    margin: 0 0 1.5rem;
    color: ${({ theme }) => theme.colors.gray11};
    font-size: 1rem;
    line-height: 1.65;
  }

  .meta {
    margin-bottom: 1.25rem;
    font-family: ${editorialLabel.fontFamily};
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 0.82rem;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .actions button,
  .actions a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.5rem 1rem;
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-radius: 0.5rem;
    background: ${({ theme }) => theme.publicDesign.surface};
    color: ${({ theme }) => theme.colors.gray12};
    box-shadow: 0 1px 2px ${boxShadowColor.cardSubtle};
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .actions a[data-tone="primary"] {
    border-color: transparent;
    background: ${({ theme }) => theme.publicDesign.accent};
    color: ${({ theme }) => theme.colors.accentControlText};
  }

  .actions button:hover,
  .actions a:hover {
    border-color: ${({ theme }) => theme.publicDesign.borderStrong};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }

  .actions a[data-tone="primary"]:hover {
    border-color: transparent;
    background: ${({ theme }) => theme.publicDesign.accentHover};
  }
`

export type EmptyStateProps = {
  label: string
  description: string
  title?: string
  actions?: ReactNode
}

export const EmptyState = ({ label, title, description, actions }: EmptyStateProps) => (
  <EmptyStateShell>
    <div className="status" aria-hidden="true">
      {label}
    </div>
    {title ? <h2>{title}</h2> : null}
    <p>{description}</p>
    {actions ? <div className="actions">{actions}</div> : null}
  </EmptyStateShell>
)

const EmptyStateShell = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.75rem;
  padding: 2.5rem 1.5rem;
  border: 1px dashed ${({ theme }) => semanticColors(theme).border};
  border-radius: 12px;
  background: ${({ theme }) => semanticColors(theme).surface};
  color: ${({ theme }) => semanticColors(theme).textPrimary};

  .status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: ${({ theme }) => semanticColors(theme).surfaceMuted};
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${({ theme }) => semanticColors(theme).textMuted};
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  p {
    margin: 0;
    max-width: 32rem;
    font-size: 0.875rem;
    color: ${({ theme }) => semanticColors(theme).textSecondary};
    line-height: 1.6;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 0.25rem;
  }
`
