import css from "styled-jsx/css"
import { control, layoutBreakpoint } from "src/design-system/tokens"

// styled-jsx 외부 스타일은 반드시 css 태그로 감싼다. 평범한 문자열을 <style jsx>에 넘기면
// scope hash가 undefined가 되고 같은 페이지의 <style jsx global>까지 주입되지 않는다.
export const privacyPageStyles = css`
  .lead {
    margin: 0 0 14px;
    color: var(--aq-text-secondary);
    line-height: 1.65;
  }

  .actionRow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 18px;
  }

  /* 버튼 위계: 주 행동만 채운 컨트롤, 보조 행동은 테두리 컨트롤, 문서 이동은 링크. */
  .actionPrimary {
    min-width: 11rem;
  }

  .actionSecondary {
    background: transparent;
    border: 1px solid var(--aq-border-strong);
    color: var(--aq-text);
    font-weight: 700;
  }

  .actionSecondary:disabled {
    background: transparent;
    border-color: var(--aq-border);
    color: var(--aq-muted);
  }

  .statusLine {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--aq-text);
    font-weight: 700;
    line-height: 1.55;
  }

  .statusDot {
    width: 8px;
    height: 8px;
    margin-top: 0.45em;
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--aq-subtle);
  }

  .statusLine[data-tone="success"] .statusDot {
    background: var(--aq-status-success);
  }

  .statusLine[data-tone="accent"] .statusDot {
    background: var(--aq-accent-link);
  }

  .detailBlock {
    margin-top: 18px;
    border-top: 1px solid var(--aq-border);
  }

  .detailBlock summary {
    display: flex;
    align-items: center;
    min-height: ${control.lg}px;
    color: var(--aq-text-secondary);
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }

  .detailBlock summary::-webkit-details-marker {
    display: none;
  }

  .detailBlock summary::after {
    content: "";
    width: 7px;
    height: 7px;
    margin-left: 9px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: translateY(-2px) rotate(45deg);
  }

  .detailBlock[open] summary::after {
    transform: translateY(1px) rotate(-135deg);
  }

  .snapshotSkeleton {
    display: grid;
    gap: 12px;
    margin-top: 4px;
  }

  .detailList,
  .snapshotList {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin: 0;
  }

  .detailList {
    margin-bottom: 16px;
  }

  .detailList div,
  .snapshotList div {
    min-width: 0;
  }

  dt {
    color: var(--aq-muted);
    font-size: 0.82rem;
    font-weight: 800;
  }

  dd {
    margin: 5px 0 0;
    overflow-wrap: anywhere;
    color: var(--aq-text);
    font-weight: 700;
  }

  .requestForm {
    display: grid;
    gap: 14px;
  }

  .requestForm label {
    display: grid;
    gap: 7px;
    color: var(--aq-text-secondary);
    font-weight: 800;
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid var(--aq-border);
    border-radius: 7px;
    padding: 11px 12px;
    color: var(--aq-text);
    font: inherit;
  }

  .muted,
  .requestResult {
    margin: 12px 0 0;
    color: var(--aq-text-secondary);
    line-height: 1.6;
  }

  /* 위계 3단계 중 링크 단계: 정책 문서 이동은 버튼이 아니라 포인트 블루 링크로만 노출한다. */
  .lead :global(a),
  .muted :global(a) {
    color: var(--aq-accent-link);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .feedback {
    margin: 12px 0 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-weight: 800;
    line-height: 1.55;
  }

  .feedback::before {
    content: "";
    width: 8px;
    height: 8px;
    margin-top: 0.45em;
    border-radius: 50%;
    flex: 0 0 auto;
    background: currentColor;
  }

  .feedback[data-tone="danger"] {
    color: var(--aq-status-danger);
  }

  .feedback[data-tone="success"] {
    color: var(--aq-status-success);
  }

  @media (max-width: ${layoutBreakpoint.editorCompact}px) {
    .actionPrimary,
    .actionSecondary {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .detailList,
    .snapshotList {
      grid-template-columns: 1fr;
    }
  }
`
