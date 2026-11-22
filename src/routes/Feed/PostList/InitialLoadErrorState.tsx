/**
 * 참조 구현:
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/{empty,alert}.tsx, MIT License, Copyright (c) 2023 shadcn)
 * - lucide-icons/lucide (icons/circle-alert.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import React, { memo } from "react"
import styled from "@emotion/styled"
import { useLanguage } from "src/libs/language"

type Props = {
  hasFilter: boolean
  onRetryInitialLoad?: () => void
}

const InitialLoadErrorState: React.FC<Props> = ({ hasFilter, onRetryInitialLoad }) => {
  const { t } = useLanguage()
  return (
    <StyledWrapper role="alert" aria-live="assertive">
      <div className="initialLoadErrorIcon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width={20}
          height={20}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h3>{hasFilter ? t("initialErrorFilterTitle") : t("initialErrorTitle")}</h3>
      <p>{t("initialErrorDesc")}</p>
      <button type="button" className="retryBtn" onClick={onRetryInitialLoad}>
        {t("initialErrorRetry")}
      </button>
    </StyledWrapper>
  )
}

export default memo(InitialLoadErrorState)

const StyledWrapper = styled.section`
  grid-column: 1 / -1;
  border: 1px dashed ${({ theme }) => theme.colors.red6};
  border-radius: 12px;
  min-height: 11rem;
  padding: 2rem 1.25rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.6rem;
  text-align: center;

  .initialLoadErrorIcon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.statusDangerSurface};
    border: 1px solid ${({ theme }) => theme.colors.red6};
    color: ${({ theme }) => theme.colors.red11};
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.red11};
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.35;
  }

  p {
    margin: 0;
    max-width: 29rem;
    color: var(--aq-muted);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  button,
  .retryBtn {
    min-height: 36px;
    padding: 0 0.82rem;
    border-radius: 6px;
    border: 1px solid var(--aq-border-strong);
    background: var(--aq-surface-elevated);
    color: var(--aq-text);
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      border-color: var(--aq-text);
      background: var(--aq-surface-subtle);
    }

    @media (max-width: 820px), (pointer: coarse) {
      min-height: 44px;
    }
  }
`
