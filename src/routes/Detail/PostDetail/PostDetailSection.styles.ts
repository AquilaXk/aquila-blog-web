import styled from "@emotion/styled";
export const MobileSummaryBar = styled.div `
  display: none;

  @media (max-width: 820px) {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin-bottom: 28px;

    button {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 6px;
      border: 1px solid ${({ theme }) => theme.colors.gray6};
      background: ${({ theme }) => theme.publicDesign.readableSurface};
      color: ${({ theme }) => theme.colors.gray10};
      box-shadow: none;
    }

    button[data-active="true"] {
      border-color: ${({ theme }) => theme.colors.accentBorder};
      background: ${({ theme }) => theme.publicDesign.readableSurface};
      color: ${({ theme }) => (theme.colors.accentLink)};
    }

    button span,
    button strong {
      display: none;
    }

    button[data-feedback="true"] {
      width: auto;
      padding: 0 12px;
      gap: 6px;

      span {
        display: inline;
        font-size: 0.8125rem;
        font-weight: 650;
      }
    }

    > span {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 12px;
      border-radius: 6px;
      border: 1px solid ${({ theme }) => theme.colors.gray6};
      background: ${({ theme }) => theme.publicDesign.readableSurface};
      color: ${({ theme }) => theme.colors.gray10};
      font-size: 0.8125rem;
      font-weight: 650;

      > span {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }
    }
  }
`;
export const RelatedSection = styled.section `
  margin-top: 64px;
  padding-top: 40px;
  border-top: 1px solid var(--aq-border);
  content-visibility: auto;
  contain-intrinsic-size: 1px 420px;

  h3 {
    margin: 0 0 22px;
    color: var(--aq-text);
    font-size: 22px;
    line-height: 1.25;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    min-width: 0;
  }

  li + li a {
    border-top: 1px solid var(--aq-border);
  }

  li a {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 20px;
    min-width: 0;
    padding: 18px 0;
    color: var(--aq-text);
    text-decoration: none;
    transition: color 0.18s cubic-bezier(0.215, 0.61, 0.355, 1);

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--aq-accent-link, var(--aq-accent));

        .relatedArrow {
          transform: translateX(4px);
        }
      }
    }
  }

  .relatedItemCopy {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  strong {
    color: currentColor;
    font-size: 16px;
    line-height: 1.4;
    font-weight: 780;
    letter-spacing: -0.02em;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .relatedMeta {
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 600;
  }

  .relatedArrow {
    display: inline-block;
    color: currentColor;
    font-size: 18px;
    line-height: 1;
    transition: transform 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    li a,
    .relatedArrow {
      transition: none;
    }

    li a:hover .relatedArrow {
      transform: none;
    }
  }
`;
export const RelatedSkeletonItem = styled.li `
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 18px 0;

  & + & {
    border-top: 1px solid var(--aq-border);
  }

  .titleLine,
  .metaLine {
    display: block;
    border-radius: 4px;
    background: var(--aq-border);
    animation: related-skeleton-pulse 1.18s ease-in-out infinite;
  }

  .titleLine {
    width: min(70%, 17rem);
    height: 0.98rem;
  }

  .metaLine {
    width: 1.2rem;
    height: 1rem;
  }

  @keyframes related-skeleton-pulse {
    0% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.7;
    }
  }
`;
