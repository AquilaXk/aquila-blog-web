import { dehydrate, DehydratedState } from "@tanstack/react-query"
import { IncomingMessage } from "http"
import { GetServerSidePropsResult } from "next"
import { ApiError } from "src/apis/backend/client"
import { queryKey } from "src/constants/queryKey"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import type { AuthMember } from "src/hooks/useAuthSession"
import { createQueryClient } from "src/libs/react-query"
import { normalizeAdminNextPath, toAdminLoginPath } from "src/libs/router"
import { serverApiFetchJson } from "./backend"
import { guardAdminRequest } from "./adminGuard"
import { hasServerAuthCookie } from "./authSession"
import {
  fetchServerAdminProfile,
  resolvePublicAdminProfileSnapshot,
} from "./adminProfile"

export type AdminPageProps = {
  dehydratedState: DehydratedState
  initialMember: AuthMember
  initialProfileSnapshot?: AdminProfile | null
}

type AdminProtectedBootstrapResult<T> =
  | { ok: true; value: T }
  | { ok: false; destination: string | null }

const resolveAdminInitialProfileSnapshot = async (req: IncomingMessage): Promise<AdminProfile> => {
  return (
    (await fetchServerAdminProfile(req, {
      timeoutMs: 900,
    })) || resolvePublicAdminProfileSnapshot(req).profile
  )
}

export const buildAdminPagePropsFromMember = (
  member: AuthMember,
  initialProfileSnapshot: AdminProfile | null = null
): AdminPageProps => {
  const queryClient = createQueryClient()
  queryClient.setQueryData(queryKey.authMeProbe(), true)
  queryClient.setQueryData(queryKey.authMe(), member)

  return {
    dehydratedState: dehydrate(queryClient),
    initialMember: member,
    initialProfileSnapshot,
  }
}

export const readAdminProtectedBootstrap = async <T>(
  req: IncomingMessage,
  path: string,
  fallbackPath: string
): Promise<AdminProtectedBootstrapResult<T>> => {
  try {
    const value = await serverApiFetchJson<T>(req, path)
    return {
      ok: true,
      value,
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      // 5xx/network/timeout 등 → Next 500 (destination: null 제거)
      throw error
    }

    const shouldDeferRedirectToFallback = hasServerAuthCookie(req)
    if (error.status === 401) {
      return {
        ok: false,
        destination: shouldDeferRedirectToFallback
          ? null
          : toAdminLoginPath(normalizeAdminNextPath(req.url, fallbackPath), fallbackPath),
      }
    }
    if (error.status === 403) {
      return {
        ok: false,
        destination: shouldDeferRedirectToFallback ? null : "/",
      }
    }

    // 그 외 HTTP 실패 → Next 500
    throw error
  }
}

export const getAdminPageProps = async (
  req: IncomingMessage
): Promise<GetServerSidePropsResult<AdminPageProps>> => {
  const guardResult = await guardAdminRequest(req)

  if (!guardResult.ok) {
    return {
      redirect: {
        destination: guardResult.destination,
        permanent: false,
      },
    }
  }

  return {
    props: buildAdminPagePropsFromMember(guardResult.member, await resolveAdminInitialProfileSnapshot(req)),
  }
}
