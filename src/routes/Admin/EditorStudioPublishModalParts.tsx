/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/tabs.tsx (MIT License, Copyright (c) shadcn)
 */
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useState } from "react"
import AppIcon from "./AdminAppIcon"
import { useLanguage } from "src/libs/language"
import { buildPostOgImagePath } from "src/libs/og/ogUrl"
import {
  CompactPublishEditorCard,
  CompactPublishEditorStack,
  CompactPublishEditorToggle,
  FieldHelp,
  OptionalCoverDisclosure,
  OptionalCoverSummary,
  PostPreviewSetup,
  PreviewEditorGrid,
  SectionKicker,
  VisibilityCard,
  VisibilityOptionButton,
  VisibilityOptionGrid,
} from "./EditorStudioPublishModalStyles"
import {
  SerpPreviewHeaderRow,
  SerpPreviewSection,
  SerpPreviewTabButton,
  SerpPreviewTabs,
  SerpResultCard,
  SerpResultSnippet,
  SerpResultTitle,
  SerpResultUrl,
  SocialOgCard,
  SocialOgDescription,
  SocialOgDomain,
  SocialOgImageContainer,
  SocialOgMeta,
  SocialOgNoImage,
  SocialOgTitle,
} from "./EditorStudioPublishModalSerpStyles"
import { handleTablistKeyDown } from "./adminTablistKeyboard"
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
}: VisibilitySectionProps) => {
  const handleRadioKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (visibilityOptions.length === 0) return
    const isNext = event.key === "ArrowDown" || event.key === "ArrowRight"
    const isPrev = event.key === "ArrowUp" || event.key === "ArrowLeft"
    if (!isNext && !isPrev) return

    event.preventDefault()
    const currentIndex = Math.max(
      0,
      visibilityOptions.findIndex((item) => item.value === postVisibility)
    )
    const nextIndex = isNext
      ? (currentIndex + 1) % visibilityOptions.length
      : (currentIndex - 1 + visibilityOptions.length) % visibilityOptions.length
    const nextOption = visibilityOptions[nextIndex]
    if (!nextOption) return
    onPostVisibilityChange(nextOption.value)
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons[nextIndex]?.focus()
  }

  return (
    <VisibilityCard data-testid="publish-visibility-panel">
      <SectionKicker>노출 범위</SectionKicker>
      <strong>누가 이 글을 볼 수 있나요?</strong>
      <VisibilityOptionGrid
        role="radiogroup"
        aria-label="노출 범위 선택"
        onKeyDown={handleRadioKeyDown}
      >
        {visibilityOptions.map((option) => {
          const isChecked = postVisibility === option.value
          return (
            <VisibilityOptionButton
              key={option.value}
              type="button"
              role="radio"
              tabIndex={isChecked ? 0 : -1}
              data-active={isChecked}
              aria-checked={isChecked}
              onClick={() => onPostVisibilityChange(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </VisibilityOptionButton>
          )
        })}
      </VisibilityOptionGrid>
      <FieldHelp>메인 피드 노출은 전체 공개에서만 활성화됩니다.</FieldHelp>
    </VisibilityCard>
  )
}

type CardSettingsProps = {
  closeToggleLabel: string
  hasManualThumbnail?: boolean
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
  hasManualThumbnail = false,
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
    <OptionalCoverDisclosure open={hasManualThumbnail || undefined}>
      <OptionalCoverSummary>
        <div>
          <strong>공유 대표 이미지 직접 지정 (선택)</strong>
          <span>
            {setupDescription ||
              "비워두면 본문 첫 이미지 또는 제목 기반 OG 카드가 공유 미리보기에 자동 적용됩니다."}
          </span>
        </div>
        <em>{hasManualThumbnail ? "수동 지정됨" : "자동 적용"}</em>
      </OptionalCoverSummary>
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
                <span>드래그/확대로 공유 대표 이미지 초점을 맞춥니다.</span>
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
                <span>썸네일 URL과 업로드 방식을 설정합니다.</span>
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
    </OptionalCoverDisclosure>
  </PostPreviewSetup>
)

export const resolveSiteOrigin = (): string => {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, "")
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return "https://www.aquilaxk.site"
}

export const resolveSiteHostname = (): string => {
  try {
    const origin = resolveSiteOrigin()
    return new URL(origin).hostname
  } catch {
    return "www.aquilaxk.site"
  }
}

type SerpPreviewProps = {
  title: string
  summary: string
  thumbnailUrl?: string
  postUrl?: string
  postId?: string | number
}

const SERP_PREVIEW_TABS = ["serp", "social"] as const

export const EditorStudioPublishSerpPreview = ({
  title,
  summary,
  thumbnailUrl,
  postUrl,
  postId,
}: SerpPreviewProps) => {
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState<(typeof SERP_PREVIEW_TABS)[number]>("serp")
  const [ogImageFailed, setOgImageFailed] = useState(false)

  const siteOrigin = resolveSiteOrigin()
  const siteHostname = resolveSiteHostname()
  const defaultPostPath = postId ? `/posts/${postId}` : "/posts/..."
  const displayUrl = postUrl || `${siteOrigin}${defaultPostPath}`

  const displayTitle = title.trim() || (language === "en" ? "Untitled" : "제목 없음")
  const displaySummary = summary.trim()
    ? summary.trim().slice(0, 160)
    : language === "en"
    ? "No summary provided. Search engines will automatically display the beginning of the post."
    : "요약문이 없습니다. 검색엔진에는 글 본문 첫 머리가 자동으로 노출됩니다."
  const resolvedOgSrc = thumbnailUrl || buildPostOgImagePath({ title: displayTitle })

  useEffect(() => {
    setOgImageFailed(false)
  }, [resolvedOgSrc])

  return (
    <SerpPreviewSection>
      <SerpPreviewHeaderRow>
        <SectionKicker>
          {language === "en" ? "Share & Search Preview" : "공유 & 검색 미리보기"}
        </SectionKicker>
        <SerpPreviewTabs
          role="tablist"
          aria-label={language === "en" ? "Preview Mode" : "미리보기 모드"}
          onKeyDown={(event) => handleTablistKeyDown(event, SERP_PREVIEW_TABS, activeTab, setActiveTab)}
        >
          <SerpPreviewTabButton
            id="publish-preview-tab-serp"
            type="button"
            role="tab"
            tabIndex={activeTab === "serp" ? 0 : -1}
            aria-selected={activeTab === "serp"}
            data-active={activeTab === "serp"}
            onClick={() => setActiveTab("serp")}
          >
            {language === "en" ? "Search Engine (SERP)" : "검색 엔진 결과"}
          </SerpPreviewTabButton>
          <SerpPreviewTabButton
            id="publish-preview-tab-social"
            type="button"
            role="tab"
            tabIndex={activeTab === "social" ? 0 : -1}
            aria-selected={activeTab === "social"}
            data-active={activeTab === "social"}
            onClick={() => setActiveTab("social")}
          >
            {language === "en" ? "Social Card (OG)" : "소셜 카드 (OG)"}
          </SerpPreviewTabButton>
        </SerpPreviewTabs>
      </SerpPreviewHeaderRow>

      {activeTab === "serp" ? (
        <SerpResultCard
          id="publish-preview-panel-serp"
          role="tabpanel"
          aria-labelledby="publish-preview-tab-serp"
        >
          <SerpResultUrl>{displayUrl}</SerpResultUrl>
          <SerpResultTitle>{displayTitle}</SerpResultTitle>
          <SerpResultSnippet>{displaySummary}</SerpResultSnippet>
        </SerpResultCard>
      ) : (
        <SocialOgCard
          id="publish-preview-panel-social"
          role="tabpanel"
          aria-labelledby="publish-preview-tab-social"
        >
          <SocialOgImageContainer>
            {ogImageFailed ? (
              <SocialOgNoImage>
                <AppIcon name="camera" />
                <span>
                  {language === "en"
                    ? "Preview image unavailable"
                    : "미리보기 이미지를 불러올 수 없습니다."}
                </span>
              </SocialOgNoImage>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedOgSrc}
                alt={displayTitle}
                loading="lazy"
                decoding="async"
                onError={() => setOgImageFailed(true)}
              />
            )}
          </SocialOgImageContainer>
          <SocialOgMeta>
            <SocialOgDomain>{siteHostname}</SocialOgDomain>
            <SocialOgTitle>{displayTitle}</SocialOgTitle>
            <SocialOgDescription>{displaySummary}</SocialOgDescription>
          </SocialOgMeta>
        </SocialOgCard>
      )}
    </SerpPreviewSection>
  )
}
