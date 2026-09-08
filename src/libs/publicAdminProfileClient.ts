import type { AdminProfile } from "src/types/adminProfile"
import { parseCanonicalAdminProfile } from "src/libs/canonicalAdminProfile"

export const PUBLIC_ADMIN_PROFILE_PATH = "/member/api/v1/members/adminProfile"

export const fetchPublicAdminProfile = async (): Promise<AdminProfile> => {
  const { apiFetch } = await import("src/apis/backend/client")
  return parseCanonicalAdminProfile(await apiFetch<unknown>(PUBLIC_ADMIN_PROFILE_PATH))
}
