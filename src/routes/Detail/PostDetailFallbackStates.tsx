import styled from "@emotion/styled"
import { ErrorState, skeletonShimmerCss } from "src/design-system/StatePresenters"
import { useLanguage } from "src/libs/language"

export const PostDetailErrorFallback = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useLanguage()
  return (
    <ErrorState
      label="ERROR"
      title={t("postDetailErrorTitle")}
      description={t("postDetailErrorDesc")}
      actions={
        <button type="button" onClick={onRetry}>
          {t("postDetailErrorRetry")}
        </button>
      }
    />
  )
}

export const PostDetailLoadingFallback = () => (
  <LoadingShell aria-live="polite" aria-busy="true">
    <div className="hero">
      <div className="eyebrow" />
      <div className="title" />
      <div className="metaRow">
        <div className="avatar" />
        <div className="meta" />
      </div>
      <div className="summary" />
    </div>
    <div className="layout">
      <div className="bodyCard">
        <div className="cover" />
        <div className="line wide" />
        <div className="line wide" />
        <div className="line medium" />
        <div className="line wide" />
        <div className="line medium" />
        <div className="line narrow" />
      </div>
      <div className="rail" aria-hidden="true">
        <div className="railCard" />
        <div className="railCard" />
      </div>
    </div>
  </LoadingShell>
)

const LoadingShell = styled.section`
  display: grid;
  gap: 1.25rem;
  margin-top: 1rem;
  padding-bottom: 2rem;

  .eyebrow,
  .title,
  .avatar,
  .meta,
  .summary,
  .railCard,
  .cover,
  .line {
    border-radius: 2px;
    ${skeletonShimmerCss}
    background: ${({ theme }) => theme.colors.gray3};
  }

  .hero {
    display: grid;
    gap: 0.85rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.gray5};
  }

  .eyebrow {
    height: 18px;
    width: min(22%, 120px);
  }

  .title {
    height: 52px;
    width: min(72%, 560px);
    border-radius: 4px;
  }

  .metaRow {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 4px;
  }

  .meta {
    height: 20px;
    width: min(38%, 240px);
  }

  .summary {
    height: 20px;
    width: min(58%, 420px);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .rail {
    display: none;
    gap: 0.85rem;
  }

  .railCard {
    height: 124px;
    border-radius: 4px;
  }

  .bodyCard {
    display: grid;
    gap: 0.95rem;
  }

  .cover {
    height: min(34vh, 280px);
    width: 100%;
    border-radius: 4px;
  }

  .line {
    height: 18px;
  }

  .line.wide {
    width: 100%;
  }

  .line.medium {
    width: min(88%, 760px);
  }

  .line.narrow {
    width: min(70%, 620px);
  }

  @media (min-width: 1280px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 17rem;
      align-items: start;
    }

    .rail {
      display: grid;
    }
  }
`
