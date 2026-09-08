import type { ReactNode } from "react"
import {
  CompactPublishEditorCard,
  CompactPublishEditorStack,
  CompactPublishEditorToggle,
  FieldHelp,
  PostPreviewHeader,
  PostPreviewSetup,
  PreviewEditorGrid,
  SectionKicker,
  VisibilityCard,
  VisibilityOptionButton,
  VisibilityOptionGrid,
} from "./EditorStudioPublishModalStyles"
import type { PostVisibility } from "./editorStudioState"

export type EditorStudioPublishVisibilityOption = {
  value: PostVisibility
  label: string
  description: string
}

type VisibilitySectionProps = {
  postVisibility: PostVisibility
  visibilityOptions: EditorStudioPublishVisibilityOption[]
  onPostVisibilityChange: (nextVisibility: PostVisibility) => void
}

export const EditorStudioPublishVisibilitySection = ({
  postVisibility,
  visibilityOptions,
  onPostVisibilityChange,
}: VisibilitySectionProps) => (
  <VisibilityCard data-testid="publish-visibility-panel">
    <SectionKicker>노출 범위</SectionKicker>
    <strong>누가 이 글을 볼 수 있나요?</strong>
    <VisibilityOptionGrid role="group" aria-label="노출 범위 선택">
      {visibilityOptions.map((option) => (
        <VisibilityOptionButton
          key={option.value}
          type="button"
          data-active={postVisibility === option.value}
          aria-pressed={postVisibility === option.value}
          onClick={() => onPostVisibilityChange(option.value)}
        >
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </VisibilityOptionButton>
      ))}
    </VisibilityOptionGrid>
    <FieldHelp>메인 피드 노출은 전체 공개에서만 활성화됩니다.</FieldHelp>
  </VisibilityCard>
)

type CardSettingsProps = {
  closeToggleLabel: string
  isCompactMobileLayout: boolean
  isMobileMetaEditorOpen: boolean
  isMobileThumbnailEditorOpen: boolean
  previewMetaEditorPanel: ReactNode
  setupDescription?: string
  thumbnailEditorPanel: ReactNode
  onToggleMobileMetaEditor: () => void
  onToggleMobileThumbnailEditor: () => void
}

export const EditorStudioPublishCardSettings = ({
  closeToggleLabel,
  isCompactMobileLayout,
  isMobileMetaEditorOpen,
  isMobileThumbnailEditorOpen,
  previewMetaEditorPanel,
  setupDescription,
  thumbnailEditorPanel,
  onToggleMobileMetaEditor,
  onToggleMobileThumbnailEditor,
}: CardSettingsProps) => (
  <PostPreviewSetup>
    <PostPreviewHeader>
      <strong>카드 요소 편집</strong>
      {setupDescription ? <span>{setupDescription}</span> : null}
    </PostPreviewHeader>
    {isCompactMobileLayout ? (
      <CompactPublishEditorStack>
        <CompactPublishEditorCard>
          <CompactPublishEditorToggle
            type="button"
            aria-expanded={isMobileThumbnailEditorOpen}
            onClick={onToggleMobileThumbnailEditor}
          >
            <div>
              <strong>썸네일 위치 조정</strong>
              <span>드래그/확대로 카드 크롭을 빠르게 맞춥니다.</span>
            </div>
            <span>{isMobileThumbnailEditorOpen ? closeToggleLabel : "열기"}</span>
          </CompactPublishEditorToggle>
          {isMobileThumbnailEditorOpen ? thumbnailEditorPanel : null}
        </CompactPublishEditorCard>
        <CompactPublishEditorCard>
          <CompactPublishEditorToggle
            type="button"
            aria-expanded={isMobileMetaEditorOpen}
            onClick={onToggleMobileMetaEditor}
          >
            <div>
              <strong>카드 메타 편집</strong>
              <span>썸네일 URL과 요약만 따로 정리합니다.</span>
            </div>
            <span>{isMobileMetaEditorOpen ? closeToggleLabel : "열기"}</span>
          </CompactPublishEditorToggle>
          {isMobileMetaEditorOpen ? previewMetaEditorPanel : null}
        </CompactPublishEditorCard>
      </CompactPublishEditorStack>
    ) : (
      <PreviewEditorGrid>
        {thumbnailEditorPanel}
        {previewMetaEditorPanel}
      </PreviewEditorGrid>
    )}
  </PostPreviewSetup>
)
