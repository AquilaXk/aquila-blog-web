import { useMemo, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import styled from "@emotion/styled"
import { useLanguage } from "../../libs/language"
import { buildPostInternalLinkTargets } from "../../libs/markdown/internalWikilinkResolver"
import { adminT } from "../../routes/Admin/adminI18n"
import {
  getRegisteredPostSuggestions,
  subscribeInternalPostSuggestions,
  type InternalPostSuggestion,
} from "./markdownEditorCompletions"

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
  padding: 12px 56px 64px;
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

const EMPTY_POST_SUGGESTIONS: InternalPostSuggestion[] = []
const getServerPostSuggestions = () => EMPTY_POST_SUGGESTIONS

type MarkdownEditorReadingPreviewProps = {
  value: string
  disableMermaid?: boolean
  internalLinkTargets?: Readonly<Record<string, string>>
}

export const MarkdownEditorReadingPreview = ({
  value,
  disableMermaid = false,
  internalLinkTargets,
}: MarkdownEditorReadingPreviewProps) => {
  const registeredSuggestions = useSyncExternalStore(
    subscribeInternalPostSuggestions,
    getRegisteredPostSuggestions,
    getServerPostSuggestions
  )
  const resolvedInternalLinkTargets = useMemo(() => {
    if (internalLinkTargets) return internalLinkTargets
    const computed = buildPostInternalLinkTargets(value, registeredSuggestions)
    return Object.keys(computed).length > 0 ? computed : undefined
  }, [internalLinkTargets, registeredSuggestions, value])

  return (
    <ReadingPreviewRoot
      className="aq-editor-reading-surface"
      data-testid="markdown-editor-reading-surface"
    >
      <ReadingPreviewCanvas>
        <DynamicMarkdownRenderer
          content={value}
          disableMermaid={disableMermaid}
          internalLinkTargets={resolvedInternalLinkTargets}
        />
      </ReadingPreviewCanvas>
    </ReadingPreviewRoot>
  )
}
