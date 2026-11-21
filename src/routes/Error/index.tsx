/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (app/not-found.tsx, MIT License)
 */
import styled from "@emotion/styled"
import Link from "next/link"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { useLanguage } from "src/libs/language"

const CustomError = () => {
  const { t } = useLanguage()

  return (
    <StyledWrapper>
      <div className="codeColumn">
        <h1>404</h1>
      </div>
      <div className="contentColumn">
        <p className="lead">{t("error404Title")}</p>
        <p className="desc">{t("error404Desc")}</p>
        <div className="actions">
          <Link href="/" className="primary">
            {t("error404HomeButton")}
          </Link>
          <Link href="/about" className="secondary">
            {t("emptyAboutButton")}
          </Link>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default CustomError

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: min(60vh, 34rem);
  padding: 2rem 0 4rem;
  color: ${({ theme }) => theme?.colors?.gray12 ?? "var(--aq-text)"};

  @media (min-width: 768px) {
    margin-top: 6rem;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
  }

  .codeColumn {
    padding-top: 1.5rem;
    padding-bottom: 2rem;

    @media (min-width: 768px) {
      padding-top: 0;
      padding-bottom: 0;
    }
  }

  .codeColumn h1 {
    margin: 0;
    font-size: 3.75rem;
    line-height: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: ${({ theme }) => theme?.colors?.gray12 ?? "var(--aq-text)"};

    @media (min-width: 768px) {
      border-right: 2px solid ${({ theme }) => theme?.publicDesign?.border ?? "var(--aq-border)"};
      padding-right: 1.5rem;
      font-size: 6rem;
      line-height: 3.5rem;
    }
  }

  .contentColumn {
    max-width: 28rem;
  }

  .lead {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    line-height: 1.5;
    font-weight: 700;
    color: ${({ theme }) => theme?.colors?.gray12 ?? "var(--aq-text)"};

    @media (min-width: 768px) {
      font-size: 1.5rem;
    }
  }

  .desc {
    margin: 0 0 2rem;
    font-size: 1rem;
    line-height: 1.65;
    color: ${({ theme }) => theme?.colors?.gray11 ?? "var(--aq-muted)"};
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .actions a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-decoration: none;
    box-shadow: 0 1px 2px ${boxShadowColor.cardSubtle};
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .actions a.primary {
    border: 1px solid transparent;
    background: ${({ theme }) => theme?.publicDesign?.accent ?? "var(--aq-accent)"};
    color: ${({ theme }) => theme?.colors?.accentControlText ?? "var(--aq-on-accent)"};

    &:hover {
      background: ${({ theme }) => theme?.publicDesign?.accentHover ?? "var(--aq-accent)"};
    }
  }

  .actions a.secondary {
    border: 1px solid ${({ theme }) => theme?.publicDesign?.border ?? "var(--aq-border)"};
    background: ${({ theme }) => theme?.publicDesign?.surface ?? "var(--aq-surface)"};
    color: ${({ theme }) => theme?.colors?.gray12 ?? "var(--aq-text)"};

    &:hover {
      border-color: ${({ theme }) => theme?.publicDesign?.borderStrong ?? "var(--aq-border-strong)"};
      background: ${({ theme }) => theme?.publicDesign?.surfaceElevated ?? "var(--aq-surface-elevated)"};
    }
  }
`
