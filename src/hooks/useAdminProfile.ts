import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProfileCardLinkItem } from "src/constants/profileCardLinks"
import { queryKey } from "src/constants/queryKey"
import { normalizeBlogDesign, normalizeLegacyBlogScheme } from "src/libs/profileWorkspace"
import type { AboutProjectBlock, AboutSectionBlock } from "src/libs/profileWorkspace"
import { fetchPublicAdminProfile } from "src/libs/publicAdminProfileClient"
import type { BlogDesignType, LegacyBlogScheme } from "src/types"
import type { AdminProfile } from "src/types/adminProfile"

export type { AdminProfile } from "src/types/adminProfile"

type AdminProfileLike = {
  username: string
  name?: string
  nickname?: string
  modifiedAt?: string
  profileImageUrl?: string
  profileImageDirectUrl?: string
  profileRole?: string
  profileBio?: string
  aboutHeadline?: string
  aboutRole?: string
  aboutBio?: string
  aboutDetails?: string
  aboutSections?: AboutSectionBlock[]
  aboutProjectSectionTitle?: string
  aboutProjects?: AboutProjectBlock[]
  blogTitle?: string
  homeIntroTitle?: string
  homeIntroDescription?: string
  blogDesign?: BlogDesignType
  legacyBlogScheme?: LegacyBlogScheme
  serviceLinks?: ProfileCardLinkItem[]
  contactLinks?: ProfileCardLinkItem[]
}

type UseAdminProfileOptions = {
  enabled?: boolean
  refetchOnMount?: boolean
  staleTimeMs?: number
}

export const toAdminProfile = (value: AdminProfileLike): AdminProfile => ({
  username: value.username,
  name: value.name || value.nickname || value.username,
  nickname: value.nickname || value.name || value.username,
  modifiedAt: value.modifiedAt,
  profileImageUrl: value.profileImageUrl || "",
  profileImageDirectUrl: value.profileImageDirectUrl,
  profileRole: value.profileRole,
  profileBio: value.profileBio,
  aboutHeadline: value.aboutHeadline,
  aboutRole: value.aboutRole,
  aboutBio: value.aboutBio,
  aboutDetails: value.aboutDetails,
  aboutSections: value.aboutSections || [],
  aboutProjectSectionTitle: value.aboutProjectSectionTitle,
  aboutProjects: value.aboutProjects || [],
  blogTitle: value.blogTitle,
  homeIntroTitle: value.homeIntroTitle,
  homeIntroDescription: value.homeIntroDescription,
  blogDesign: normalizeBlogDesign(value.blogDesign),
  legacyBlogScheme: normalizeLegacyBlogScheme(value.legacyBlogScheme),
  serviceLinks: value.serviceLinks || [],
  contactLinks: value.contactLinks || [],
})

export const setAdminProfileCache = (queryClient: QueryClient, profile: AdminProfile | null) => {
  queryClient.setQueryData(queryKey.adminProfile(), profile)
}

export const useAdminProfile = (initialProfile: AdminProfile | null = null, options: UseAdminProfileOptions = {}) => {
  const isBrowser = typeof window !== "undefined"
  const canFetch = options.enabled ?? true
  const queryClient = useQueryClient()
  const cacheKey = queryKey.adminProfile()
  const cachedProfile = queryClient.getQueryData<AdminProfile | null>(cacheKey)
  const seededProfile = cachedProfile ?? initialProfile
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

  return query.data ?? initialProfile
}
