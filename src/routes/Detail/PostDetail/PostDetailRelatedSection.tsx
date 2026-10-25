import { memo } from "react"
import Link from "next/link"
import { formatDate } from "src/libs/utils"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import type { TPost } from "src/types"
import { RelatedSection, RelatedSkeletonItem } from "./PostDetail.styles"

const RELATED_SKELETON_COUNT = 2

type RelatedPostsSectionProps = {
  showRelatedTagSkeleton: boolean
  relatedByTagPosts: TPost[]
  showRelatedAuthorSkeleton: boolean
  relatedByAuthorPosts: TPost[]
}

const renderSkeletonItems = (prefix: string) =>
  Array.from({ length: RELATED_SKELETON_COUNT }, (_, index) => (
    <RelatedSkeletonItem key={`${prefix}-skeleton-${index}`} aria-hidden="true">
      <span className="titleLine" />
      <span className="metaLine" />
    </RelatedSkeletonItem>
  ))

const getRelatedPostMeta = (post: TPost) => {
  const taxonomy = post.tags?.[0] || post.category?.[0] || post.type?.[0] || "Post"
  return `${taxonomy} · ${formatDate(post.createdAt || post.date?.start_date || post.createdTime || "")}`
}

export const selectUniqueRelatedPosts = (
  relatedByTagPosts: readonly TPost[],
  relatedByAuthorPosts: readonly TPost[],
  limit = 2
): TPost[] => {
  if (limit <= 0) return []
  const result: TPost[] = []
  const seenIds = new Set<string>()
  const sources = [relatedByTagPosts, relatedByAuthorPosts]
  for (let s = 0; s < sources.length; s += 1) {
    const list = sources[s]
    for (let i = 0; i < list.length; i += 1) {
      const post = list[i]
      if (!post?.id || !post?.slug || seenIds.has(post.id)) continue
      seenIds.add(post.id)
      result.push(post)
      if (result.length >= limit) return result
    }
  }
  return result
}

const RelatedPostsSectionComponent = ({
  showRelatedTagSkeleton,
  relatedByTagPosts,
  showRelatedAuthorSkeleton,
  relatedByAuthorPosts,
}: RelatedPostsSectionProps) => {
  const relatedPosts = selectUniqueRelatedPosts(relatedByTagPosts, relatedByAuthorPosts, 2)
  const showSkeleton = relatedPosts.length === 0 && (showRelatedTagSkeleton || showRelatedAuthorSkeleton)

  if (!showSkeleton && relatedPosts.length === 0) return null

  return (
    <RelatedSection aria-label="관련 글">
      <h3>관련 글</h3>
      <ul>
        {showSkeleton
          ? renderSkeletonItems("related")
          : relatedPosts.map((post) => (
              <li key={post.id}>
                <Link href={toCanonicalPostPath(post.id)}>
                  <span className="relatedItemCopy">
                    <strong>{post.title}</strong>
                    <span className="relatedMeta">{getRelatedPostMeta(post)}</span>
                  </span>
                  <span className="relatedArrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
      </ul>
    </RelatedSection>
  )
}

export const RelatedPostsSection = memo(RelatedPostsSectionComponent)
RelatedPostsSection.displayName = "RelatedPostsSection"
