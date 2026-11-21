/**
 * 참조 구현:
 * - TryGhost/Koenig packages/koenig-lexical/src/components/ui/MarkdownHelpModal.jsx (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/sheet.tsx (MIT License, Copyright (c) shadcn)
 */
import { useRef } from "react"
import styled from "@emotion/styled"
import { CONFIG } from "site.config"
import { EditorIconClose } from "src/components/markdown-editor/MarkdownEditorIcons"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor, overlayScrim } from "src/design-system/tokens"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import { zIndexes } from "src/styles/zIndexes"
import { adminT } from "./adminI18n"
import {
  adminBorder,
  adminBorderSubtle,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export const EditorGuideBackdrop = styled.div`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.editorGuide};
  display: flex;
  justify-content: flex-end;
  overflow: hidden;
  overscroll-behavior: contain;
  background: ${overlayScrim.sheet};
`

export const EditorGuidePanel = styled.aside`
  width: min(100%, 560px);
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overscroll-behavior: contain;
  border-left: 1px solid ${adminBorder};
  background: ${adminSurface};
  box-shadow: -24px 0 70px ${boxShadowColor.drawer};

  header {
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 22px;
    border-bottom: 1px solid ${adminBorderSubtle};
  }

  h2 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  header button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${adminTextSecondary};
    cursor: pointer;
    ${focusVisibleRing}
    &:hover {
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }
    @media (max-width: 768px), (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
    }
  }
`

export const EditorGuideBody = styled.div`
  overflow: auto;
  overscroll-behavior: contain;
  padding: 20px 22px calc(50px + env(safe-area-inset-bottom, 0px));

  > p {
    margin: 0 0 18px;
    color: ${adminTextSecondary};
    font-size: 0.86rem;
    line-height: 1.65;
  }
`

export const EditorGuideGrid = styled.div`
  display: grid;
  gap: 0;
  border-top: 1px solid ${adminBorderSubtle};

  .guideHead {
    display: grid;
    grid-template-columns: 124px minmax(0, 1fr) 88px;
    gap: 12px;
    padding: 8px 4px;
    border-bottom: 1px solid ${adminBorder};
    color: ${adminTextMuted};
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  section {
    min-width: 0;
    display: grid;
    grid-template-columns: 124px minmax(0, 1fr) 88px;
    align-items: start;
    gap: 12px;
    padding: 13px 4px;
    border-bottom: 1px solid ${adminBorderSubtle};
  }

  .rowMeta {
    min-width: 0;
  }

  h3 {
    margin: 0 0 3px;
    color: ${adminTextPrimary};
    font-size: 13px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 11.5px;
    line-height: 1.4;
  }

  pre {
    margin: 0;
    padding: 7px 10px;
    overflow: auto;
    border: 0;
    border-radius: 6px;
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
    font: 550 11.5px/1.52 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .shortcutCol {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    padding-top: 2px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 6px;
    border-radius: 5px;
    border: 1px solid ${adminBorder};
    background: ${adminSurfaceRaised};
    color: ${adminTextSecondary};
    font: 600 10.5px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    .guideHead {
      display: none;
    }

    section {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    .shortcutCol {
      justify-content: flex-start;
    }
  }
`

export const EditorGuideRepo = styled.div`
  margin-top: 18px;
  padding: 14px 0 0;
  border-top: 1px solid ${adminBorderSubtle};

  strong {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: ${adminTextPrimary};
  }

  a {
    color: ${adminTextSecondary};
    font-size: 12px;
    text-decoration: underline;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;

    &:hover {
      color: ${adminTextPrimary};
    }
  }
`

const GUIDE_REFERENCE_ROWS_KO: ReadonlyArray<readonly [string, string, string, string]> = [
  ["제목과 강조", "문서 구조·인라인 강조", "# 제목 1 / ## 제목 2 / ### 제목 3\n**굵게** · _기울임_ · ==하이라이트==", "⌘B · ⌘I"],
  ["목록과 인용", "목록·체크박스·인용문", "- 목록 / - [x] 완료 / - [ ] 예정\n> 인용문", "⌘Enter"],
  ["콜아웃", "TIP · INFO · WARNING · DANGER", "> [!DANGER]\n> **제목**\n> 내용", "/callout"],
  ["토글", "보조 설명 접기·펼치기", ":::toggle 자세히 보기\n내용\n:::", "/toggle"],
  ["표와 코드", "GFM 표·파일명 코드블록", "| 항목 | 설명 |\n```kotlin title=\"invalidatePost.kt\"\ncode\n```", "/table · ```"],
  ["Mermaid", "순서도·구조 다이어그램", "```mermaid\nflowchart LR\n  A --> B\n```", "/mermaid"],
  ["수식과 색상", "KaTeX 수식·인라인 색상", "$$\nE = mc^2\n$$\n{{color:sky|강조}}", "/math · $$"],
  ["미디어·북마크", "이미지·위키링크·북마크", "![설명](URL){width=480 align=center}\n[[글제목]] · :::bookmark URL", "⌘K · /"],
]

const GUIDE_REFERENCE_ROWS_EN: ReadonlyArray<readonly [string, string, string, string]> = [
  ["Headings & Style", "Document headings and inline styles", "# H1 / ## H2 / ### H3\n**Bold** · _Italic_ · ==Highlight==", "⌘B · ⌘I"],
  ["Lists & Quotes", "Bullets, tasks, and blockquotes", "- Item / - [x] Done / - [ ] Todo\n> Quote", "⌘Enter"],
  ["Callout", "TIP · INFO · WARNING · DANGER", "> [!DANGER]\n> **Title**\n> Body", "/callout"],
  ["Toggle", "Collapsible detail section", ":::toggle Details\nBody\n:::", "/toggle"],
  ["Tables & Code", "GFM table & titled code fence", "| Key | Desc |\n```kotlin title=\"invalidatePost.kt\"\ncode\n```", "/table · ```"],
  ["Mermaid", "Flowcharts and diagrams", "```mermaid\nflowchart LR\n  A --> B\n```", "/mermaid"],
  ["Math & Color", "KaTeX math & inline color", "$$\nE = mc^2\n$$\n{{color:sky|Accent}}", "/math · $$"],
  ["Media & Cards", "Images, wikilinks & bookmarks", "![Alt](URL){width=480 align=center}\n[[Post Title]] · :::bookmark URL", "⌘K · /"],
]

export const EditorStudioGuideModal = ({ onClose }: { onClose: () => void }) => {
  const { language } = useLanguage()
  const rows = language === "en" ? GUIDE_REFERENCE_ROWS_EN : GUIDE_REFERENCE_ROWS_KO
  const projectRepository = CONFIG.projects?.[0]
  const dialogRef = useRef<HTMLElement | null>(null)
  const { handleKeyDown } = useModalFocusTrap({
    open: true,
    onClose,
    containerRef: dialogRef,
  })

  return (
    <EditorGuideBackdrop onClick={onClose}>
      <EditorGuidePanel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={adminT("editorGuideTitle", language)}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>{adminT("editorGuideTitle", language)}</h2>
          </div>
          <button type="button" aria-label={adminT("editorGuideClose", language)} onClick={onClose}>
            <EditorIconClose size={15} />
          </button>
        </header>
        <EditorGuideBody>
          <p>{adminT("editorGuideIntro", language)}</p>
          <EditorGuideGrid>
            <div className="guideHead" aria-hidden="true">
              <span>{adminT("editorGuideColElement", language)}</span>
              <span>{adminT("editorGuideColExample", language)}</span>
              <span style={{ textAlign: "right" }}>{adminT("editorGuideColShortcut", language)}</span>
            </div>
            {rows.map(([title, description, code, shortcut]) => (
              <section key={title}>
                <div className="rowMeta">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <pre>{code}</pre>
                <div className="shortcutCol">
                  <kbd>{shortcut}</kbd>
                </div>
              </section>
            ))}
          </EditorGuideGrid>
          {projectRepository?.href ? (
            <EditorGuideRepo>
              <strong>{adminT("editorGuideRepoLabel", language)}</strong>
              <a href={projectRepository.href} target="_blank" rel="noreferrer">
                {projectRepository.href}
              </a>
            </EditorGuideRepo>
          ) : null}
        </EditorGuideBody>
      </EditorGuidePanel>
    </EditorGuideBackdrop>
  )
}
