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
  byTag: readonly TPost[],
  byAuthor: readonly TPost[],
  limit = 2
): TPost[] => {
  if (limit <= 0) return []
  const selected: TPost[] = []
  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    const source = sourceIndex === 0 ? byTag : byAuthor
    for (let i = 0; i < source.length; i += 1) {
      const candidate = source[i]
      let duplicate = false
      for (let j = 0; j < selected.length; j += 1) {
        if (selected[j].id === candidate.id) {
          duplicate = true
          break
        }
      }
      if (duplicate) continue
      selected.push(candidate)
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
