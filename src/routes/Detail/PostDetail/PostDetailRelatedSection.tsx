/**
 * 참조 구현:
 * - fuma-nama/fumadocs (MIT License)
 * - lucide-icons/lucide (icons/arrow-right.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import { memo } from "react"
import Link from "next/link"
import { useLanguage } from "src/libs/language"
import { formatDate } from "src/libs/utils"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import type { TPost } from "src/types"
import { RelatedSection, RelatedSkeletonItem } from "./PostDetailSection.styles"

const RELATED_SKELETON_COUNT = 4
const RELATED_POSTS_DEFAULT_LIMIT = 4

export type RelatedPostsSectionProps = {
  showRelatedTagSkeleton: boolean
  relatedByTagPosts: TPost[]
  showRelatedAuthorSkeleton: boolean
  relatedByAuthorPosts: TPost[]
  excludePostIds?: ReadonlyArray<string | number | null | undefined>
}

const renderSkeletonItems = (prefix: string) =>
  Array.from({ length: RELATED_SKELETON_COUNT }, (_, index) => (
    <RelatedSkeletonItem key={`${prefix}-skeleton-${index}`} aria-hidden="true">
      <span className="titleLine" />
      <span className="metaLine" />
    </RelatedSkeletonItem>
  ))

const formatRelatedPostMeta = (post: TPost, locale: string) => {
  const taxonomy = post.tags?.[0] || post.category?.[0] || post.type?.[0] || "Post"
  const rawDate = post.createdAt || post.date?.start_date || post.createdTime || ""
  return `${taxonomy} · ${formatDate(rawDate, locale)}`
}

export const selectUniqueRelatedPosts = (
  relatedByTagPosts: readonly TPost[],
  relatedByAuthorPosts: readonly TPost[],
  limit = RELATED_POSTS_DEFAULT_LIMIT,
  excludePostIds: ReadonlyArray<string | number | null | undefined> = []
): TPost[] => {
  if (limit <= 0) return []
  const seenIds = new Set<string>()
  for (let i = 0; i < excludePostIds.length; i += 1) {
    const excludeId = excludePostIds[i]
    if (excludeId !== null && excludeId !== undefined && String(excludeId)) {
      seenIds.add(String(excludeId))
    }
  }
  const selected: TPost[] = []
  const sources = [relatedByTagPosts, relatedByAuthorPosts]

  for (let s = 0; s < sources.length; s += 1) {
    const list = sources[s]
    for (let i = 0; i < list.length; i += 1) {
      const post = list[i]
      if (!post?.id) continue
      const postId = String(post.id)
      if (seenIds.has(postId)) continue
      seenIds.add(postId)
      selected.push(post)
      if (selected.length >= limit) return selected
    }
  }

  return selected
}

const RelatedPostsSectionComponent = ({
  showRelatedTagSkeleton,
  relatedByTagPosts,
  showRelatedAuthorSkeleton,
  relatedByAuthorPosts,
  excludePostIds,
}: RelatedPostsSectionProps) => {
  const { t, language } = useLanguage()
  const locale = language === "en" ? "en-US" : "ko-KR"
  const relatedPosts = selectUniqueRelatedPosts(
    relatedByTagPosts,
    relatedByAuthorPosts,
    RELATED_POSTS_DEFAULT_LIMIT,
    excludePostIds
  )
  const showSkeleton = relatedPosts.length === 0 && (showRelatedTagSkeleton || showRelatedAuthorSkeleton)

  if (!showSkeleton && relatedPosts.length === 0) return null

  return (
    <RelatedSection aria-label={t("postRelatedAria")}>
      <h3>{t("postRelatedHeading")}</h3>
      <ul>
        {showSkeleton
          ? renderSkeletonItems("related")
          : relatedPosts.map((post) => (
              <li key={post.id}>
                <Link href={toCanonicalPostPath(post.id)}>
                  <span className="relatedItemCopy">
                    <strong>{post.title}</strong>
                    <span className="relatedMeta">{formatRelatedPostMeta(post, locale)}</span>
                  </span>
                  <span className="relatedArrow" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
      </ul>
    </RelatedSection>
  )
}

export const RelatedPostsSection = memo(RelatedPostsSectionComponent)
RelatedPostsSection.displayName = "RelatedPostsSection"
