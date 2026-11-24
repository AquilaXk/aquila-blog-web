/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/ScrollTopAndComment.tsx, layouts/PostLayout.tsx, MIT License)
 * - lucide-icons/lucide (icons/arrow-left.svg, icons/arrow-right.svg, icons/arrow-up.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import styled from "@emotion/styled"
import Link from "next/link"
import { boxShadowColor, breakpoint } from "src/design-system/tokens"
import { useLanguage } from "src/libs/language"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { zIndexes } from "src/styles/zIndexes"
import type { TPost } from "src/types"

export type PostDetailNavigationChromeProps = {
  previousPost: TPost | null
  nextPost: TPost | null
  showBackToTop: boolean
  onBackToTop: () => void
  tags?: string[]
}

const MobileFooterMeta = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--aq-border);

  .mobileMetaTags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.5rem;
  }

  .mobileTagLink {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.72rem;
    border-radius: 9999px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface-subtle);
    color: var(--aq-text-secondary);
    font-size: 0.8125rem;
    line-height: 1.25;
    font-weight: 550;
    text-decoration: none;
    transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;

    @media (hover: hover) {
      &:hover {
        border-color: var(--aq-accent);
        background: var(--aq-surface-elevated);
        color: var(--aq-accent-link, var(--aq-accent));
      }
    }

    @media (pointer: coarse) {
      min-height: 44px;
    }
  }

  .mobileBackWrap {
    display: block;
  }

  @media (min-width: ${breakpoint.lg}px) {
    .mobileMetaTags,
    .mobileBackWrap {
      display: none;
    }
  }

  .mobileBackLink {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 44px;
    color: var(--aq-accent-link, var(--aq-accent));
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }
`

const AdjacentNav = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const AdjacentCardLink = styled(Link)`
  display: grid;
  gap: 5px;
  min-width: 0;
  min-height: 44px;
  padding: 16px 18px;
  border: 1px solid var(--aq-border);
  border-radius: 0.75rem;
  background: var(--aq-surface);
  color: var(--aq-text);
  text-decoration: none;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;

  @media (hover: hover) {
    &:hover {
      border-color: var(--aq-border-strong, var(--aq-accent));
      background: var(--aq-surface-subtle);
      color: var(--aq-accent-link, var(--aq-accent));
    }
  }

  &.isNext {
    text-align: right;

    .navDirection {
      justify-content: flex-end;
    }
  }

  .navDirection {
    display: inline-flex;
    align-items: center;
    gap: 0.32rem;
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  strong {
    color: currentColor;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:focus-visible {
    outline: 2px solid var(--aq-accent);
    outline-offset: 2px;
  }
`

const BackToTopButton = styled.button<{ $visible: boolean }>`
  position: fixed;
  right: max(2rem, env(safe-area-inset-right));
  bottom: max(2rem, env(safe-area-inset-bottom));
  z-index: ${zIndexes.header - 1};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--aq-border);
  border-radius: 9999px;
  background: var(--aq-surface-subtle);
  color: var(--aq-muted);
  box-shadow: 0 4px 12px ${boxShadowColor.cardHover};
  cursor: pointer;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? "visible" : "hidden")};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "8px")});
  transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.16s ease, color 0.16s ease;

  &:focus-visible {
    outline: 2px solid var(--aq-accent);
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: var(--aq-surface-elevated);
      color: var(--aq-text);
    }
  }

  @media (max-width: 820px) {
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1.25rem, env(safe-area-inset-bottom));
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`

export const PostDetailNavigationChrome = ({
  previousPost,
  nextPost,
  showBackToTop,
  onBackToTop,
  tags = [],
}: PostDetailNavigationChromeProps) => {
  const { language, t } = useLanguage()
  const isEn = language === "en"

  return (
    <>
      <MobileFooterMeta>
        {tags.length > 0 ? (
          <div className="mobileMetaTags">
            {tags.map((tag) => (
              <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="mobileTagLink">
                {tag}
              </Link>
            ))}
          </div>
        ) : null}
        {previousPost || nextPost ? (
          <AdjacentNav aria-label={isEn ? "Previous and next posts" : "이전 및 다음 글"}>
            {previousPost ? (
              <AdjacentCardLink href={toCanonicalPostPath(previousPost.id)}>
                <span className="navDirection">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                  <span>{isEn ? "Previous" : "이전 글"}</span>
                </span>
                <strong>{previousPost.title || (isEn ? "Untitled" : "제목 없음")}</strong>
              </AdjacentCardLink>
            ) : (
              <div aria-hidden="true" />
            )}
            {nextPost ? (
              <AdjacentCardLink href={toCanonicalPostPath(nextPost.id)} className="isNext">
                <span className="navDirection">
                  <span>{isEn ? "Next" : "다음 글"}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
                <strong>{nextPost.title || (isEn ? "Untitled" : "제목 없음")}</strong>
              </AdjacentCardLink>
            ) : (
              <div aria-hidden="true" />
            )}
          </AdjacentNav>
        ) : null}
        <div className="mobileBackWrap">
          <Link href="/" className="mobileBackLink">
            <span aria-hidden="true">←</span>
            <span>{t("postAllPosts")}</span>
          </Link>
        </div>
      </MobileFooterMeta>

      <BackToTopButton
        type="button"
        $visible={showBackToTop}
        aria-label={isEn ? "Back to top" : "맨 위로 이동"}
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        onClick={onBackToTop}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m5 12 7-7 7 7" />
          <path d="M12 19V5" />
        </svg>
      </BackToTopButton>
    </>
  )
}
