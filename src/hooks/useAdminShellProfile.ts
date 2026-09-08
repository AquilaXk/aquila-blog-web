import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "src/apis/backend/client"
import type { AuthMember } from "src/hooks/useAuthSession"
import type { AdminProfile } from "src/types/adminProfile"

type AdminShellBootstrapPayload = {
  member: Pick<AuthMember, "id">
  profile: AdminProfile | null
}

const ADMIN_SHELL_PROFILE_QUERY_KEY = (memberId: number) => ["admin", "shell-profile", memberId] as const

export const readAdminShellProfile = async (memberId: number): Promise<AdminProfile> => {
  const payload = await apiFetch<AdminShellBootstrapPayload>("/member/api/v1/adm/members/bootstrap")

  if (!payload || payload.member?.id !== memberId) {
    throw new Error("Admin shell profile canonical member mismatch")
  }
  if (
    !payload.profile ||
    typeof payload.profile.profileImageUrl !== "string" ||
    (payload.profile.blogTitle !== undefined && typeof payload.profile.blogTitle !== "string")
  ) {
    throw new Error("Admin shell profile canonical profile is unavailable")
  }

  return payload.profile
}

export const useAdminShellProfile = (memberId: number, initialProfile: AdminProfile | null = null) => {
  const isBrowser = typeof window !== "undefined"
  const query = useQuery<AdminProfile>({
    queryKey: ADMIN_SHELL_PROFILE_QUERY_KEY(memberId),
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
