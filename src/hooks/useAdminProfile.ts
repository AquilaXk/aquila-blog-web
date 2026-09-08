import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { fetchPublicAdminProfile } from "src/libs/publicAdminProfileClient"
import type { AdminProfile } from "src/types/adminProfile"

export type { AdminProfile } from "src/types/adminProfile"

type UseAdminProfileOptions = {
  enabled?: boolean
  refetchOnMount?: boolean
  staleTimeMs?: number
}

export const setAdminProfileCache = (queryClient: QueryClient, profile: AdminProfile | null) => {
  queryClient.setQueryData(queryKey.adminProfile(), profile)
}

export const refreshAdminProfileCache = async (queryClient: QueryClient): Promise<boolean> => {
  setAdminProfileCache(queryClient, null)
  try {
    setAdminProfileCache(queryClient, await fetchPublicAdminProfile())
    return true
  } catch {
    // 갱신 실패 시 이전 프로필이나 세션 데이터로 공개본을 복원하지 않는다.
    return false
  }
}

export const useAdminProfile = (initialProfile: AdminProfile | null = null, options: UseAdminProfileOptions = {}) => {
  const isBrowser = typeof window !== "undefined"
  const canFetch = options.enabled ?? true
  const queryClient = useQueryClient()
  const cacheKey = queryKey.adminProfile()
  const cachedProfile = queryClient.getQueryData<AdminProfile | null>(cacheKey)
  const seededProfile = cachedProfile === undefined ? initialProfile : cachedProfile
  const hasSeedProfile = seededProfile != null

  const query = useQuery<AdminProfile | null>({
    queryKey: cacheKey,
    queryFn: fetchPublicAdminProfile,
    enabled: isBrowser && canFetch,
    throwOnError: true,
    initialData: seededProfile ?? undefined,
    staleTime: options.staleTimeMs ?? (hasSeedProfile ? 5 * 60 * 1000 : 0),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: canFetch && (options.refetchOnMount ?? !hasSeedProfile),
  })

  return query.data === undefined ? initialProfile : query.data
}
