import { dehydrate } from "@tanstack/react-query"
import type { GetServerSidePropsResult } from "next"
import type { ServerResponse } from "node:http"
import { getPostDetailById } from "src/apis"
import { apiFetch } from "src/apis/backend/client"
import { queryKey } from "src/constants/queryKey"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import { createQueryClient } from "src/libs/react-query"
import { registerServerApiFetchMetrics } from "src/libs/server/apiFetchMetrics"
import {
  resolveStaticAdminProfileSeed,
} from "src/libs/server/adminProfile"
import type { StaticAdminProfileSeedSource } from "src/libs/adminProfileSource"

export { resolveStaticAdminProfileSeed } from "src/libs/server/adminProfile"

type DetailPageProps = {
  dehydratedState: unknown
  initialAdminProfile: AdminProfile | null
  initialAdminProfileSource: StaticAdminProfileSeedSource
}

type FetchStaticAdminProfile = () => Promise<AdminProfile>

const IS_QA_CLIENT_FETCH_MODE = process.env.ENABLE_QA_ROUTES === "true"

const toSerializableState = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, currentValue) => (currentValue === undefined ? null : currentValue))
  )

const fetchPublicAdminProfile: FetchStaticAdminProfile = async () => {
  return await apiFetch<AdminProfile>("/member/api/v1/members/adminProfile")
}

export const buildCanonicalPostDetailServerProps = async (
  postId: string,
  res: Pick<ServerResponse, "setHeader">,
): Promise<GetServerSidePropsResult<DetailPageProps>> => {
  // 상세 본문의 공개 권한은 요청마다 확인하며 HTML/data 응답도 공유 캐시에 남기지 않는다.
  res.setHeader("Cache-Control", "private, no-store")
  registerServerApiFetchMetrics()
  const queryClient = createQueryClient()
  // QA에서는 브라우저가 API 응답을 주입한다. 실제 서버 장애를 성공으로 바꾸는 경로가 아니다.
  const postDetail = IS_QA_CLIENT_FETCH_MODE ? null : await getPostDetailById(postId)
  if (!IS_QA_CLIENT_FETCH_MODE && !postDetail) return { notFound: true }
  const adminProfileSeed = await resolveStaticAdminProfileSeed(fetchPublicAdminProfile)
  const initialAdminProfile = adminProfileSeed.profile
  const initialAdminProfileSource = adminProfileSeed.source
  queryClient.setQueryData(queryKey.adminProfile(), initialAdminProfile)

  if (postDetail) {
    queryClient.setQueryData(queryKey.post(postDetail.id), postDetail)
  }
  return {
    props: {
      dehydratedState: toSerializableState(dehydrate(queryClient)),
      initialAdminProfile,
      initialAdminProfileSource,
    },
  }
}
