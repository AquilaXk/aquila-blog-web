import styled from "@emotion/styled";
import { control, layoutBreakpoint } from "src/design-system/tokens";
export const StyledWrapper = styled.div `
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  margin: 0 auto;
  min-width: 0;
  padding: 0;
  color: var(--aq-text);
  position: relative;
  z-index: 0;
  isolation: isolate;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: -1;
    width: 100%;
    background: var(--aq-page-bg);
    pointer-events: none;
  }

  .detailReadProgress {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 90;
    width: 100%;
    height: 2px;
    pointer-events: none;

    span {
      display: block;
      width: 100%;
      height: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      will-change: transform;
      background: var(--aq-accent-link);
    }
  }

  .detailHero {
    width: 100%;
    margin: 0 auto;
    padding: 68px 20px 42px;
    border-bottom: 1px solid var(--aq-border);
    box-sizing: border-box;
  }

  .detailLayout {
    display: grid;
    width: min(100%, 1180px);
    margin: 0 auto;
    grid-template-columns: 64px minmax(0, 760px) 240px;
    justify-content: center;
    gap: 44px;
    padding: 54px 20px 100px;
    min-width: 0;
    overflow: visible;
  }

  article {
    margin: 0 auto;
    max-width: 760px;
    display: grid;
    gap: 0;
    min-width: 0;
    width: 100%;
    position: relative;
    z-index: 0;
  }

  article > * {
    min-width: 0;
  }

  .relatedPrefetchTrigger {
    width: 100%;
    height: 1px;
  }

  .leftRail,
  .rightRail {
    min-width: 0;
    position: sticky;
    top: calc(var(--app-header-height, var(--app-header-mobile-height, 64px)) + 1.25rem);
    align-self: start;
    overflow: visible;
    z-index: 1;
  }

  .leftRailInner,
  .rightRailInner {
    position: static;
  }

  .detailLayout[data-left-hybrid="true"] .leftRail,
  .detailLayout[data-right-hybrid="true"] .rightRail {
    position: relative;
    top: 0;
    align-self: stretch;
  }

  .detailLayout[data-left-hybrid="true"] .leftRailInner,
  .detailLayout[data-right-hybrid="true"] .rightRailInner {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }

  .floatingActionButton {
    width: ${control.lg}px;
    height: ${control.lg}px;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-text-secondary);
    cursor: default;
    transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;

    svg {
      width: 1em;
      height: 1em;
      font-size: 1.125rem;
    }
  }

  button.floatingActionButton {
    cursor: pointer;

    &:hover {
      border-color: var(--aq-accent-link);
      background: var(--aq-surface);
      color: var(--aq-accent-link);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .floatingActionButton[data-tooltip] {
      position: relative;
    }

    .floatingActionButton[data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      left: 50%;
      top: calc(100% + 0.45rem);
      transform: translateX(-50%);
      white-space: nowrap;
      padding: 0.3rem 0.48rem;
      border-radius: 4px;
      border: 1px solid var(--aq-border);
      background: var(--aq-surface);
      color: var(--aq-text-secondary);
      font-size: 0.68rem;
      line-height: 1;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      z-index: 4;
    }

    .floatingActionButton[data-tooltip]:hover::after,
    .floatingActionButton[data-tooltip]:focus-visible::after {
      opacity: 1;
    }
  }

  .floatingShareButton {
    color: var(--aq-text-secondary);
  }

  .floatingLikeCluster {
    display: grid;
    justify-items: center;
    row-gap: 8px;
  }

  .floatingLikeStat {
    display: grid;
    justify-items: center;
    row-gap: 0.36rem;
  }

  .floatingShareStat {
    display: grid;
    justify-items: center;
    row-gap: 0.36rem;
  }

  .floatingLikeCount {
    font-size: 10px;
    line-height: 1;
    font-weight: 600;
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }

  .floatingShareFeedback {
    font-size: 0.64rem;
    line-height: 1;
    font-weight: 600;
    color: var(--aq-muted);
    text-align: center;
  }

  .rightRailInner {
    border-left: 1px solid var(--aq-border);
    padding: 0 0 0 18px;
    background: transparent;

    .rightRailHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 14px;
    }

    .rightRailTitleGroup {
      display: grid;
      gap: 0.18rem;
      min-width: 0;
    }

    .rightRailTitle {
      margin: 0;
      color: var(--aq-text);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.6875rem;
      line-height: 1;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tocDepthToggle {
      border: 1px solid var(--aq-border);
      border-radius: 6px;
      background: var(--aq-surface);
      color: var(--aq-text-secondary);
      font-size: 0.71rem;
      font-weight: 700;
      line-height: 1;
      min-height: ${control.lg}px;
      padding: 0 0.5rem;
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        color: var(--aq-text);
        border-color: var(--aq-border-strong);
      }
    }

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: block;
      max-height: min(34rem, calc(100vh - 10rem));
      overflow-y: auto;
      overflow-x: hidden;
    }

    li {
      min-width: 0;
      margin: 0;
    }

    li[data-level="3"] button {
      padding-left: 0.54rem;
      font-size: 0.78rem;
    }

    li[data-level="4"] button {
      padding-left: 0.88rem;
      font-size: 0.75rem;
    }

    button {
      width: 100%;
      display: flex;
      align-items: center;
      text-align: left;
      border: 0;
      border-radius: 0;
      min-height: ${control.lg}px;
      box-sizing: border-box;
      max-width: 100%;
      padding: 0.5rem 0;
      background: transparent;
      color: var(--aq-text-secondary);
      font-size: 12px;
      line-height: 1.4;
      cursor: pointer;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: keep-all;
      position: relative;
      transition: color 0.15s ease;
    }

    button:hover {
      color: var(--aq-text);
      background: transparent;
    }

    button[data-active="true"] {
      color: var(--aq-accent-link);
      font-weight: 750;
      background: transparent;
    }
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    .detailLayout {
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 28px;
    }

    .detailLayout[data-toc="true"] {
      grid-template-columns: 52px minmax(0, 1fr) minmax(148px, 180px);
    }

    .detailLayout[data-toc="false"] .rightRail {
      display: none;
    }
  }

  .mobileToc {
    display: none;
  }

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    .detailHero {
      padding: 44px 20px 28px;
    }

    .detailLayout {
      width: auto;
      display: block;
      gap: 0;
      padding: 30px 20px 70px;
    }

    .leftRail,
    .rightRail {
      display: none;
    }

    article {
      max-width: 760px;
    }

    .mobileToc {
      display: block;
      margin: 0 0 28px;
      border: 1px solid var(--aq-border);
      border-radius: 6px;
      background: var(--aq-surface);
    }

    .mobileTocSummary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: ${control.lg}px;
      padding: 0 0.9rem;
      color: var(--aq-text);
      font-size: 0.875rem;
      font-weight: 750;
      line-height: 1.2;
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }

      &::after {
        content: "";
        width: 7px;
        height: 7px;
        border-right: 1.5px solid var(--aq-muted);
        border-bottom: 1.5px solid var(--aq-muted);
        transform: translateY(-2px) rotate(45deg);
        transition: transform 180ms ease;
      }
    }

    .mobileToc[open] .mobileTocSummary::after {
      transform: translateY(1px) rotate(225deg);
    }

    .mobileTocList {
      margin: 0;
      padding: 0 0.5rem 0.5rem;
      list-style: none;
      border-top: 1px solid var(--aq-border);
      max-height: min(52dvh, 360px);
      overflow-y: auto;
    }

    .mobileTocList li {
      margin: 0;
      min-width: 0;
    }

    .mobileTocList li[data-level="3"] button {
      padding-left: 1.1rem;
    }

    .mobileTocList li[data-level="4"] button {
      padding-left: 1.7rem;
    }

    .mobileTocList button {
      width: 100%;
      display: flex;
      align-items: center;
      min-height: ${control.lg}px;
      box-sizing: border-box;
      padding: 0.5rem 0.4rem;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--aq-text-secondary);
      font-size: 0.875rem;
      line-height: 1.4;
      text-align: left;
      cursor: pointer;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: keep-all;
    }

    .mobileTocList button[data-active="true"] {
      color: var(--aq-accent-link);
      font-weight: 750;
    }
  }
`;
export const BodySection = styled.div `
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
  width: 100%;
  min-width: 0;
`;
export { MobileSummaryBar, RelatedSection, RelatedSkeletonItem } from "./PostDetailSection.styles";
