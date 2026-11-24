import type { GetServerSideProps } from "next"
import dynamic from "next/dynamic"
import { NextPageWithLayout } from "../../types"
import styled from "@emotion/styled"
import MetaConfig from "src/components/MetaConfig"

const CustomError = dynamic(() => import("src/routes/Error"))
import PostDetail from "src/routes/Detail/PostDetail"
import usePostQuery from "src/hooks/usePostQuery"
import {
  buildCanonicalPostDetailServerProps,
} from "src/libs/server/postDetailPage"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import { buildPostDetailMetadata } from "src/routes/Detail/PostDetail/postDetailMetadataModel"
import { resolvePostDetailRenderState } from "src/routes/Detail/postDetailRenderState"

const PostDetailErrorFallback = dynamic(() =>
  import("src/routes/Detail/PostDetailFallbackStates").then((mod) => mod.PostDetailErrorFallback)
)
const PostDetailLoadingFallback = dynamic(() =>
  import("src/routes/Detail/PostDetailFallbackStates").then((mod) => mod.PostDetailLoadingFallback)
)

export const getServerSideProps: GetServerSideProps = withSsrMetrics("public", async ({ params, res, req }) => {
  const postId = params?.id as string
  return await buildCanonicalPostDetailServerProps(postId, res, req)
})

type CanonicalPostPageProps = {
  initialInternalLinkTargets?: Record<string, string>
}

const CanonicalPostPage: NextPageWithLayout<CanonicalPostPageProps> = ({ initialInternalLinkTargets }) => {
  const { post, isNotFound, isError, isPending, refetch } = usePostQuery()
  const renderState = resolvePostDetailRenderState({
    isNotFound,
    isError,
    isPending,
    hasPost: Boolean(post),
  })

  if (renderState === "not_found") return <CustomError />

  if (renderState === "error") {
    return <PostDetailErrorFallback onRetry={() => void refetch()} />
  }

  if (renderState === "loading") {
    return <PostDetailLoadingFallback />
  }

  if (!post) return <CustomError />

  const meta = buildPostDetailMetadata(post)

  return (
    <>
      <MetaConfig {...meta} />
      <DetailShell data-type={post.type?.[0] ?? "Post"}>
        <PostDetail initialInternalLinkTargets={initialInternalLinkTargets} />
      </DetailShell>
    </>
  )
}

CanonicalPostPage.getLayout = (page) => <>{page}</>
export default CanonicalPostPage

const DetailShell = styled.div`
  padding: 2rem 0;

  &[data-type="Paper"] {
    padding: 40px 0;
  }
`
