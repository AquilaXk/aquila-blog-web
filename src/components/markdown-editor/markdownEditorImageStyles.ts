import { EDITOR_SYNTAX_COLORS } from "./markdownEditorSyntaxThemeTokens"

export const LIVE_IMAGE_CONTROL_STYLES = `
  .cm-live-image-wrap {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 100%;
    margin: 6px 0;
    &[data-align="center"], &[data-align="right"], &[data-align="left"], &[data-align="wide"], &[data-align="full"] {
      display: flex;
      width: 100%;
    }
    &[data-align="center"], &[data-align="wide"] { align-items: center; }
    &[data-align="right"] { align-items: flex-end; }
    &[data-align="left"] { align-items: flex-start; }
    .cm-live-image-frame {
      position: relative;
      display: inline-block;
      max-width: min(100%, var(--aq-image-width, 100%));
    }
    .cm-live-image {
      display: block;
      width: var(--aq-image-width, auto);
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }
    &[data-align="full"] .cm-live-image-frame,
    &[data-align="full"] .cm-live-image { width: 100%; max-width: 100%; }
    .cm-live-image-resize-handle {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      width: 8px;
      height: 40px;
      padding: 0;
      border: 1px solid ${EDITOR_SYNTAX_COLORS.blockCardSurface};
      border-radius: 999px;
      background: ${EDITOR_SYNTAX_COLORS.accentBlueControl};
      cursor: ew-resize;
      touch-action: none;
      user-select: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .cm-live-image-controls {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      padding: 4px 6px;
      border-radius: 8px;
      border: 1px solid ${EDITOR_SYNTAX_COLORS.blockCardBorder};
      background: ${EDITOR_SYNTAX_COLORS.blockCardSurface};
      box-shadow: ${EDITOR_SYNTAX_COLORS.blockCardShadow};
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
      max-width: 100%;
    }
    &:hover .cm-live-image-resize-handle,
    &:focus-within .cm-live-image-resize-handle,
    &:hover .cm-live-image-controls,
    &:focus-within .cm-live-image-controls {
      opacity: 1;
      pointer-events: auto;
    }
    .cm-live-image-ctrl-btn {
      min-height: 26px;
      min-width: 26px;
      padding: 0 7px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: ${EDITOR_SYNTAX_COLORS.wikilinkText};
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
    }
    .cm-live-image-ctrl-btn:hover { background: ${EDITOR_SYNTAX_COLORS.accentBlueTint07}; }
    .cm-live-image-ctrl-btn[data-active="true"] {
      background: ${EDITOR_SYNTAX_COLORS.accentBlueTint12};
      border-color: ${EDITOR_SYNTAX_COLORS.accentBlueBorder32};
      color: ${EDITOR_SYNTAX_COLORS.accentBlue};
    }
    .cm-live-image-ctrl-sep {
      width: 1px;
      height: 16px;
      background: ${EDITOR_SYNTAX_COLORS.blockCardBorder};
      margin: 0 2px;
    }
    .cm-live-image-caption-input {
      min-width: 112px;
      max-width: 200px;
      height: 26px;
      padding: 0 7px;
      border-radius: 6px;
      border: 1px solid ${EDITOR_SYNTAX_COLORS.blockCardBorder};
      background: ${EDITOR_SYNTAX_COLORS.blockCardSurface};
      color: ${EDITOR_SYNTAX_COLORS.inlineCodeText};
      font-size: 0.75rem;
    }
    @media (pointer: coarse) {
      .cm-live-image-resize-handle,
      .cm-live-image-controls { opacity: 1; pointer-events: auto; }
      .cm-live-image-ctrl-btn { min-height: 44px; min-width: 44px; }
      .cm-live-image-caption-input { min-height: 44px; font-size: 16px; }
    }
  }
`
