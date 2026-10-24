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
    throwOnError: false,
    initialData: seededProfile ?? undefined,
    staleTime: options.staleTimeMs ?? (hasSeedProfile ? 5 * 60 * 1000 : 0),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: canFetch && (options.refetchOnMount ?? !hasSeedProfile),
  })

  if (query.isError) {
    return seededProfile ?? initialProfile
  }

  return query.data === undefined ? initialProfile : query.data
}
