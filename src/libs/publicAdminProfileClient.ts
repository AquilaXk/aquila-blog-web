import type { AdminProfile } from "src/types/adminProfile"

export const PUBLIC_ADMIN_PROFILE_PATH = "/member/api/v1/members/adminProfile"
const ADMIN_PROFILE_SNAPSHOT_COOKIE = "admin_profile_snapshot_v1"
const ADMIN_PROFILE_SNAPSHOT_MAX_AGE_SECONDS = 60 * 30

const persistAdminProfileSnapshotCookie = async (profile: AdminProfile) => {
  const { setCookie } = await import("cookies-next/client")
  setCookie(ADMIN_PROFILE_SNAPSHOT_COOKIE, JSON.stringify(profile), {
    path: "/",
    sameSite: "lax",
    maxAge: ADMIN_PROFILE_SNAPSHOT_MAX_AGE_SECONDS,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  })
}

export const fetchPublicAdminProfile = async (): Promise<AdminProfile> => {
  const { apiFetch } = await import("src/apis/backend/client")
  const profile = await apiFetch<AdminProfile>(PUBLIC_ADMIN_PROFILE_PATH)
  await persistAdminProfileSnapshotCookie(profile)
  return profile
}
