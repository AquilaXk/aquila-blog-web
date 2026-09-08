import type { AdminProfile } from "src/types/adminProfile"

export const PUBLIC_ADMIN_PROFILE_PATH = "/member/api/v1/members/adminProfile"

export const fetchPublicAdminProfile = async (): Promise<AdminProfile> => {
  const { apiFetch } = await import("src/apis/backend/client")
  return await apiFetch<AdminProfile>(PUBLIC_ADMIN_PROFILE_PATH)
}
