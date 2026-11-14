import styled from "@emotion/styled"
import MarkdownRenderer from "../../libs/markdown/MarkdownRenderer"

const ReadingPreviewRoot = styled.div`
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 20px 28px;
  overscroll-behavior: contain;

  @media (max-width: 820px) {
    padding: 16px 14px;
  }
`

type MarkdownEditorReadingPreviewProps = {
  value: string
  disableMermaid?: boolean
}

export const MarkdownEditorReadingPreview = ({
  value,
  disableMermaid = false,
}: MarkdownEditorReadingPreviewProps) => (
  <ReadingPreviewRoot
    className="aq-editor-reading-surface"
    data-testid="markdown-editor-reading-surface"
  >
    <MarkdownRenderer content={value} disableMermaid={disableMermaid} />
  </ReadingPreviewRoot>
)
