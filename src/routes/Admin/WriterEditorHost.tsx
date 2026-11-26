import { Profiler } from "react"
import { RecoverableSurfaceBoundary } from "src/components/error/ErrorBoundary"
import {
  MarkdownEditor,
  type MarkdownEditorFocusRequest,
} from "src/components/markdown-editor/MarkdownEditor"

type WriterEditorHostProps = {
  canvasId: string
  markdown: string
  onMarkdownChange: (markdown: string, meta?: { editorFocused: boolean }) => void
  onSelectionChange?: (selection: { from: number; to: number }) => void
  onFlushMarkdownReady: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: MarkdownEditorFocusRequest | null) => void
  onToggleViewModeRequestReady?: (toggle: (() => void) | null) => void
  onRequestFocusTitle?: () => void
  onRequestSave?: () => void
  onUploadingChange?: (isUploading: boolean) => void
  onImageUpload: (file: File) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  onFileUpload?: (file: File) => Promise<{
    url?: string
    name?: string
    mimeType?: string
    sizeBytes?: number
    description?: string
  }>
  onRequestCloudAsset?: () => void
  mermaidEnabled: boolean
  disabled?: boolean
  onCommitDuration?: (actualDuration: number) => void
}

export const WriterEditorHost = ({
  canvasId,
  markdown,
  onMarkdownChange,
  onSelectionChange,
  onFlushMarkdownReady,
  onFocusRequestReady,
  onToggleViewModeRequestReady,
  onRequestFocusTitle,
  onRequestSave,
  onUploadingChange,
  onImageUpload,
  onFileUpload,
  onRequestCloudAsset,
  mermaidEnabled,
  disabled = false,
  onCommitDuration,
}: WriterEditorHostProps) => (
  <Profiler
    id={canvasId}
    onRender={(_id, _phase, actualDuration) => {
      onCommitDuration?.(actualDuration)
    }}
  >
    <RecoverableSurfaceBoundary surface="editor" resetKey={canvasId}>
      <MarkdownEditor
        value={markdown}
        onChange={onMarkdownChange}
        onSelectionChange={onSelectionChange}
        onFlushMarkdownReady={onFlushMarkdownReady}
        onFocusRequestReady={onFocusRequestReady}
        onToggleViewModeRequestReady={onToggleViewModeRequestReady}
        onRequestFocusTitle={onRequestFocusTitle}
        onRequestSave={onRequestSave}
        onUploadingChange={onUploadingChange}
        onUploadImage={onImageUpload}
        onUploadFile={onFileUpload}
        onRequestCloudAsset={onRequestCloudAsset}
        disableMermaid={!mermaidEnabled}
        disabled={disabled}
      />
    </RecoverableSurfaceBoundary>
  </Profiler>
)
