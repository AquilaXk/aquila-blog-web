import React, { memo } from "react"
import styled from "@emotion/styled"
import AppIcon from "src/components/icons/AppIcon"
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
        <AppIcon name="question" />
      </div>
      <h3>{hasFilter ? t("initialErrorFilterTitle") : t("initialErrorTitle")}</h3>
      <p>{t("initialErrorDesc")}</p>
      <button type="button" onClick={onRetryInitialLoad}>
        {t("initialErrorRetry")}
      </button>
    </StyledWrapper>
  )
}

export default memo(InitialLoadErrorState)

const StyledWrapper = styled.section`
  grid-column: 1 / -1;
  border-top: 1px solid ${({ theme }) => theme.colors.red6};
  border-bottom: 1px solid ${({ theme }) => theme.colors.red6};
  min-height: 10rem;
  padding: 1rem 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.48rem;
  text-align: center;

  .initialLoadErrorIcon {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.colors.red6};
    color: ${({ theme }) => theme.colors.red11};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.red11};
    font-size: 1.02rem;
    font-weight: 800;
    line-height: 1.35;
  }

  p {
    margin: 0;
    max-width: 29rem;
    color: var(--aq-muted);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  button {
    min-height: 36px;
    padding: 0 0.82rem;
    border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.colors.blue7};
    background: transparent;
    color: ${({ theme }) => theme.colors.blue11};
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
  }
`
