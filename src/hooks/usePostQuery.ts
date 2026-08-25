import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { getPostDetailById } from "src/apis/backend/posts/PostApiDetailRequests"
import { withoutTrustedContentHtml } from "src/apis/backend/posts/contentHtmlTrust"
import { queryKey } from "src/constants/queryKey"
import { PostDetail } from "src/types"

const extractCanonicalPostIdFromAsPath = (asPath: string): string => {
  const pathname = asPath.split(/[?#]/, 1)[0] || ""
  const canonicalMatch = pathname.match(/^\/posts\/(\d+)(?:\/)?$/)
  return canonicalMatch ? canonicalMatch[1] : ""
}

export const resolvePostQueryData = (
  post: PostDetail | null | undefined,
  isRefetchError: boolean,
): PostDetail | null | undefined =>
  post && isRefetchError ? withoutTrustedContentHtml(post) : post

const usePostQuery = () => {
  const router = useRouter()
  const routeId =
    typeof router.query.id === "string"
      ? router.query.id
      : extractCanonicalPostIdFromAsPath(router.asPath || "")
  const hasRouteId = routeId.length > 0
  const query = useQuery<PostDetail | null>({
    queryKey: queryKey.post(routeId),
    queryFn: async () => {
      const requestedRouteId = routeId
      return getPostDetailById(requestedRouteId)
    },
    enabled: hasRouteId,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return {
    post: resolvePostQueryData(query.data, query.isRefetchError) ?? undefined,
    isLoading: !hasRouteId || query.isLoading || (query.isFetching && query.data === undefined),
    isNotFound: hasRouteId && query.status === "success" && query.data === null,
    isError: query.isError,
    isPending: !hasRouteId || query.isPending,
    refetch: query.refetch,
  }
}

export default usePostQuery
