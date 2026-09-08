import { type QueryClient, useQuery } from "@tanstack/react-query"
import { apiFetch } from "src/apis/backend/client"
import type { AuthMember } from "src/hooks/useAuthSession"
import type { AdminProfile } from "src/types/adminProfile"
import { parseCanonicalAdminProfile } from "src/libs/canonicalAdminProfile"

type AdminShellBootstrapPayload = {
  member: Pick<AuthMember, "id">
  profile: AdminProfile | null
}

export const adminShellProfileQueryKey = (memberId: number) => ["admin", "shell-profile", memberId] as const

export const refreshAdminShellProfile = (queryClient: QueryClient, memberId: number) =>
  queryClient.invalidateQueries({
    queryKey: adminShellProfileQueryKey(memberId),
    refetchType: "all",
  })

export const readAdminShellProfile = async (memberId: number): Promise<AdminProfile> => {
  const payload = await apiFetch<AdminShellBootstrapPayload>("/member/api/v1/adm/members/bootstrap")

  if (!payload || payload.member?.id !== memberId) {
    throw new Error("Admin shell profile canonical member mismatch")
  }
  return parseCanonicalAdminProfile(payload.profile)
}

export const useAdminShellProfile = (memberId: number, initialProfile: AdminProfile | null = null) => {
  const isBrowser = typeof window !== "undefined"
  const query = useQuery<AdminProfile>({
    queryKey: adminShellProfileQueryKey(memberId),
    queryFn: () => readAdminShellProfile(memberId),
    enabled: isBrowser,
    initialData: initialProfile ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    profile: query.isError ? null : (query.data ?? null),
    isLoading: query.isPending,
    isError: query.isError,
  }
}
