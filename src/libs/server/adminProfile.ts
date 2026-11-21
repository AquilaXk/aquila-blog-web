import { IncomingMessage } from "http"
import { AdminProfile } from "src/hooks/useAdminProfile"
import { parseCanonicalAdminProfile } from "src/libs/canonicalAdminProfile"
import type { PublicAdminProfileSource, StaticAdminProfileSeedSource } from "src/libs/adminProfileSource"
import { serverApiFetchJson } from "./backend"

type FetchServerAdminProfileOptions = {
  timeoutMs?: number
}

type StaticAdminProfileSeed = {
  profile: AdminProfile | null
  source: StaticAdminProfileSeedSource
}

type FetchStaticAdminProfile = () => Promise<unknown>

const PUBLISHED_PROFILE_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"
const TRANSIENT_PROFILE_CACHE_CONTROL = "private, no-store"

export const resolvePublicAdminProfileCacheControl = ({
  debugSsr,
  hasAuthCookie,
  source,
}: {
  debugSsr: boolean
  hasAuthCookie: boolean
  source: PublicAdminProfileSource
}) => {
  if (debugSsr || hasAuthCookie || source !== "published") return TRANSIENT_PROFILE_CACHE_CONTROL
  return PUBLISHED_PROFILE_CACHE_CONTROL
}

export const fetchServerAdminProfile = async (
  req: IncomingMessage,
  options: FetchServerAdminProfileOptions = {}
): Promise<AdminProfile | null> => {
  try {
    return parseCanonicalAdminProfile(await serverApiFetchJson<unknown>(req, "/member/api/v1/members/adminProfile", {
      timeoutMs: options.timeoutMs,
    }))
  } catch {
    return null
  }
}

export const resolveStaticAdminProfileSeed = async (
  fetchProfile: FetchStaticAdminProfile
): Promise<StaticAdminProfileSeed> => {
  try {
    return {
      profile: parseCanonicalAdminProfile(await fetchProfile()),
      source: "published",
    }
  } catch {
    return {
      profile: null,
      source: "unavailable",
    }
  }
}
