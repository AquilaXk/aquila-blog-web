import dynamic from "next/dynamic"
import styled from "@emotion/styled"
import { useLanguage } from "../../libs/language"
import { adminT } from "../../routes/Admin/adminI18n"

const ReadingPreviewLoadingPlaceholder = () => {
  const { language } = useLanguage()
  return <div aria-busy="true">{adminT("editorReadingPreviewLoading", language)}</div>
}

const DynamicMarkdownRenderer = dynamic(
  () => import("../../libs/markdown/MarkdownRenderer"),
  {
    ssr: false,
    loading: () => <ReadingPreviewLoadingPlaceholder />,
  }
)

const ReadingPreviewRoot = styled.div`
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px 40px 64px;
  overscroll-behavior: contain;

  @media (max-width: 820px) {
    padding: 14px 16px 32px;
  }
`

const ReadingPreviewCanvas = styled.div`
  width: 100%;
  max-width: 744px;
  margin-inline: auto;
  min-width: 0;

  @media (max-width: 820px) {
    max-width: 100%;
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
    <ReadingPreviewCanvas>
      <DynamicMarkdownRenderer content={value} disableMermaid={disableMermaid} />
    </ReadingPreviewCanvas>
  </ReadingPreviewRoot>
)
