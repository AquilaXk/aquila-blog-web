import { useRef } from "react"
import styled from "@emotion/styled"
import { CONFIG } from "site.config"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"

export const EditorStudioStatusBar = styled.footer`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  min-height: 28px;
  padding: 4px 20px;
  border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  color: ${({ theme }) => theme.colors.gray10};
  font: 600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-variant-numeric: tabular-nums;
  user-select: none;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  @media (max-width: 820px) {
    justify-content: flex-start;
    gap: 10px;
    padding: 4px 12px;
  }
`

export const EditorStudioDedicatedCanvasSection = styled.section`
  --compose-pane-readable-width: var(--article-readable-width, 48rem);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: auto;
  min-height: 0;
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;
  box-shadow: none;

  @media (max-width: 820px) {
    width: 100vw;
    max-width: 100vw;
    box-sizing: border-box;
    padding: 0;
  }
`

export const EditorPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 16px;

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  button {
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.gray9};
    cursor: pointer;
    padding: 2px 6px;
    font-size: 14px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.15s ease;
    ${focusVisibleRing}

    &:hover {
      color: ${({ theme }) => theme.colors.gray12};
      background: ${({ theme }) => theme.colors.gray3};
    }
  }
`

export const EditorOutline = styled.aside`
  min-width: 0;
  padding: 20px 14px;
  border-right: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  overflow: auto;

  h3 {
    margin: 0 0 16px;
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 0.82rem;
    line-height: 1.6;
  }

  @media (max-width: 820px) {
    display: none;
  }
`

export const EditorOutlineItem = styled.button`
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 13px;
  line-height: 1.4;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &[data-level="2"] { padding-left: 18px; }
  &[data-level="3"] { padding-left: 28px; }
  &[data-level="4"] { padding-left: 38px; }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.publicDesign.accent};
    outline-offset: 2px;
  }

  &[data-active="true"] {
    background: ${({ theme }) => theme.publicDesign.accentMuted};
    color: ${({ theme }) => theme.publicDesign.accent};
    font-weight: 600;
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    font: 700 10px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray11};
    flex-shrink: 0;
  }

  &[data-level="1"] span {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(35, 131, 226, 0.2)" : "#e9f3f7")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#93c5fd" : "#14569b")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(35, 131, 226, 0.34)" : "rgba(20, 86, 155, 0.18)")};
  }

  &[data-level="2"] span {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(144, 101, 176, 0.22)" : "#f6f3f9")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#d8b4fe" : "#5b3678")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(144, 101, 176, 0.34)" : "rgba(91, 54, 120, 0.18)")};
  }

  &[data-level="3"] span {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(16, 185, 129, 0.2)" : "#edf3ec")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#6ee7b7" : "#255c3e")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(16, 185, 129, 0.32)" : "rgba(37, 92, 62, 0.18)")};
  }

  strong {
    min-width: 0;
    font-weight: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const LocalDraftRestoreCard = styled.div`
  display: grid;
  gap: 10px;
  padding: 14px;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.blue7};
  background: ${({ theme }) => theme.colors.blue3};
  box-sizing: border-box;

  .card-header {
    font-size: 0.84rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.blue11};
    line-height: 1.4;
  }

  select {
    width: 100%;
    min-height: 38px;
    padding: 6px 10px;
    font-size: 0.84rem;
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.colors.blue7};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
    box-sizing: border-box;
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    button {
      font-size: 0.78rem;
      padding: 5px 9px;
    }
  }
`

export const EditorInspector = styled.aside`
  min-width: 0;
  display: grid;
  align-content: start;
  padding: 20px;
  border-left: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.operationSurface};
  overflow: auto;

  h3 {
    margin: 0 0 16px;
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  label > span,
  section > span {
    margin: 0;
    color: ${({ theme }) => theme.colors.gray11};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  label,
  section {
    display: grid;
    gap: 8px;
    padding: 0 0 20px;
    margin-bottom: 20px;
    border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  }

  small {
    justify-self: end;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 0.76rem;
    line-height: 1.4;
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-radius: 6px;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 0.88rem;
    padding: 10px;
    box-sizing: border-box;
  }

  select {
    min-height: 40px;
  }

  textarea {
    min-height: 84px;
    resize: vertical;
    line-height: 1.6;
  }

  p {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    margin: 0;
    font-size: 0.84rem;
  }

  @media (max-width: 1100px) {
    grid-column: 1 / -1;
    max-height: min(38vh, 360px);
    border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-left: 0;
  }

  @media (max-width: 820px) {
    max-height: none;
  }
`

export const EditorGuideBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  background: rgba(10, 12, 16, 0.42);
`

export const EditorGuidePanel = styled.aside`
  width: min(100%, 590px);
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  border-left: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: -24px 0 70px rgba(0, 0, 0, 0.18);

  header {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 20px;
    border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  }

  h2 {
    margin: 0;
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 17px;
    line-height: 1.25;
  }

  header button {
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 1.2rem;
    cursor: pointer;
    ${focusVisibleRing}
  }
`

export const EditorGuideBody = styled.div`
  overflow: auto;
  padding: 24px 22px 50px;

  > p {
    margin: 0 0 22px;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 0.92rem;
    line-height: 1.7;
  }
`

export const EditorGuideGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
  border-left: 1px solid ${({ theme }) => theme.publicDesign.border};

  section {
    min-width: 0;
    padding: 17px;
    border-right: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  }

  section:nth-of-type(2n) {
    border-right: 0;
  }

  h3 {
    margin: 0 0 8px;
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 13px;
  }

  p {
    margin: 0 0 9px;
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 12px;
    line-height: 1.45;
  }

  pre {
    margin: 0;
    min-height: 5.6rem;
    padding: 11px;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-radius: 6px;
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
    font: 650 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;

    section {
      border-right: 0;
    }
  }
`

export const EditorGuideRepo = styled.div`
  margin-top: 22px;
  padding: 17px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};

  strong {
    display: block;
    margin-bottom: 5px;
    color: ${({ theme }) => theme.colors.gray12};
  }

  a {
    color: ${({ theme }) => theme.publicDesign.accent};
    font-size: 12px;
    overflow-wrap: anywhere;
  }
`

export const EditorStudioGuideModal = ({ onClose }: { onClose: () => void }) => {
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
        aria-label="Markdown 작성 가이드"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>Markdown 작성 가이드</h2>
          </div>
          <button type="button" aria-label="가이드 닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <EditorGuideBody>
          <p>
            글 제목은 별도 필드가 H1 역할을 합니다. 본문은 Markdown 원문을 저장하고 같은 renderer로 미리보기와 공개 글을 표시합니다.
          </p>
          <EditorGuideGrid>
            {[
              ["제목과 강조", "문서 구조와 인라인 강조", "# 제목 1\n## 제목 2\n### 제목 3\n**굵게** · _기울임_"],
              ["목록과 인용", "일반 목록, 작업 목록, 인용문", "- 목록\n- [x] 완료\n- [ ] 예정\n> 인용문"],
              ["콜아웃", "TIP, INFO, WARNING, SUMMARY", "> [!TIP]\n> **제목**\n> 내용"],
              ["토글", "긴 보조 설명을 접어두기", ":::toggle 자세히 보기\n내용\n:::"],
              ["표와 코드", "GFM table과 fenced code", "| 항목 | 설명 |\n| --- | --- |\n\n```kotlin title=\"invalidatePost.kt\"\ncode\n```"],
              ["Mermaid", "흐름과 구조 다이어그램", "```mermaid\nflowchart LR\n A --> B\n```"],
              ["수식과 색상", "KaTeX block과 제한된 인라인 색상", "$$\nE = mc^2\n$$\n{{color:#155eef|강조}}"],
              ["미디어와 링크 카드", "이미지, bookmark, embed, file", "![설명](URL)\n:::bookmark URL\n제목\n설명\n:::"],
            ].map(([title, description, code]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
                <pre>{code}</pre>
              </section>
            ))}
          </EditorGuideGrid>
          {projectRepository?.href ? (
            <EditorGuideRepo>
              <strong>프로젝트 리포지터리</strong>
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
