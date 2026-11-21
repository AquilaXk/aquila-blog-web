import { dehydrate } from "@tanstack/react-query"
import type { GetServerSidePropsResult } from "next"
import type { ServerResponse } from "node:http"
import { getPostDetailById } from "src/apis"
import { apiFetch } from "src/apis/backend/client"
import { queryKey } from "src/constants/queryKey"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import { createQueryClient } from "src/libs/react-query"
import { registerServerApiFetchMetrics } from "src/libs/server/apiFetchMetrics"
import {
  resolveStaticAdminProfileSeed,
} from "src/libs/server/adminProfile"
import type { StaticAdminProfileSeedSource } from "src/libs/adminProfileSource"
import { parseLanguagePreference, type SiteLanguage } from "src/libs/language"

export { resolveStaticAdminProfileSeed } from "src/libs/server/adminProfile"

type DetailPageProps = {
  dehydratedState: unknown
  initialAdminProfile: AdminProfile | null
  initialAdminProfileSource: StaticAdminProfileSeedSource
  initialLanguage?: SiteLanguage
}

type FetchStaticAdminProfile = () => Promise<AdminProfile>

const IS_QA_CLIENT_FETCH_MODE = process.env.ENABLE_QA_ROUTES === "true"

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const toSerializableState = (value: unknown): unknown => {
  const ancestors = new WeakSet<object>()

  const convert = (current: unknown, key: string): unknown => {
    if (current === undefined || current === null) return null
    if (isObjectLike(current)) {
      const toJson = (current as { toJSON?: unknown }).toJSON
      if (typeof toJson === "function") {
        current = (toJson as (k: string) => unknown).call(current, key)
        if (current === undefined || current === null) return null
      }
    }

    const valueType = typeof current
    if (valueType === "boolean" || valueType === "string") return current
    if (valueType === "number") return Number.isFinite(current as number) ? current : null
    if (valueType !== "object") return current

    const obj = current as object
    if (obj instanceof Boolean) return obj.valueOf()
    if (obj instanceof String) return obj.valueOf()
    if (obj instanceof Number) {
      const num = obj.valueOf()
      return Number.isFinite(num) ? num : null
    }
    if (ancestors.has(obj)) return null
    ancestors.add(obj)

    try {
      if (Array.isArray(current)) {
        const len = current.length
        const result = new Array<unknown>(len)
        for (let i = 0; i < len; i += 1) {
          const item = current[i]
          const itemType = typeof item
          if (itemType === "function" || itemType === "symbol") {
            result[i] = null
          } else {
            const convertedItem = convert(item, String(i))
            const convertedType = typeof convertedItem
            result[i] =
              convertedType === "function" || convertedType === "symbol"
                ? null
                : convertedItem
          }
        }
        return result
      }

      const record = current as Record<string, unknown>
      const keys = Object.keys(record)
      const out: Record<string, unknown> = {}
      for (let i = 0; i < keys.length; i += 1) {
        const propKey = keys[i]!
        const propVal = record[propKey]
        const propType = typeof propVal
        if (propType === "function" || propType === "symbol") continue
        const convertedVal = convert(propVal, propKey)
        const convertedType = typeof convertedVal
        if (convertedType === "function" || convertedType === "symbol") continue
        if (propKey === "__proto__") {
          Object.defineProperty(out, propKey, {
            value: convertedVal,
            enumerable: true,
            writable: true,
            configurable: true,
          })
        } else {
          out[propKey] = convertedVal
        }
      }
      return out
    } finally {
      ancestors.delete(obj)
    }
  }

  const rootType = typeof value
  if (rootType === "function" || rootType === "symbol") return undefined
  return convert(value, "")
}

const fetchPublicAdminProfile: FetchStaticAdminProfile = async () => {
  return await apiFetch<AdminProfile>("/member/api/v1/members/adminProfile")
}

export const buildCanonicalPostDetailServerProps = async (
  postId: string,
  res: Pick<ServerResponse, "setHeader">,
  req?: { headers?: { cookie?: string } },
): Promise<GetServerSidePropsResult<DetailPageProps>> => {
  res.setHeader("Cache-Control", "private, no-store")
  registerServerApiFetchMetrics()
  const queryClient = createQueryClient()
  const numericPostId = Number(postId)
  if (!IS_QA_CLIENT_FETCH_MODE && (!Number.isInteger(numericPostId) || numericPostId <= 0)) {
    return { notFound: true }
  }
  const [postDetail, adminProfileSeed] = await Promise.all([
    IS_QA_CLIENT_FETCH_MODE ? Promise.resolve(null) : getPostDetailById(postId),
    resolveStaticAdminProfileSeed(fetchPublicAdminProfile),
  ])
  if (!IS_QA_CLIENT_FETCH_MODE && !postDetail) return { notFound: true }
  const initialAdminProfile = adminProfileSeed.profile
  const initialAdminProfileSource = adminProfileSeed.source
  queryClient.setQueryData(queryKey.adminProfile(), initialAdminProfile)

  if (postDetail) {
    queryClient.setQueryData(queryKey.post(postDetail.id), postDetail)
  }
  const initialLanguage = parseLanguagePreference(req?.headers?.cookie) ?? undefined
  return {
    props: {
      dehydratedState: toSerializableState(dehydrate(queryClient)),
      initialAdminProfile,
      initialAdminProfileSource,
      ...(initialLanguage ? { initialLanguage } : {}),
    },
  }
}
