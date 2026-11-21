import { NextApiRequest, NextApiResponse } from "next"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import { fetchServerAdminSession } from "src/libs/server/authSession"
import { safeTokenCompare } from "src/libs/server/safeTokenCompare"
import { invalidateServerSnapshotCache } from "src/libs/server/serverSnapshotCache"

const MAX_REVALIDATE_PATHS_PER_CALL = 32

const readSingleHeader = (value: string | string[] | undefined): string => {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim()
  return ""
}

const normalizeHostAuthority = (rawHost: string): string =>
  rawHost.trim().toLowerCase().replace(/:(80|443)$/, "")

const isSameOriginSessionRequest = (req: NextApiRequest): boolean => {
  const secFetchSite = readSingleHeader(req.headers["sec-fetch-site"]).toLowerCase()
  if (secFetchSite && secFetchSite !== "same-origin") {
    return false
  }

  const effectiveHost = normalizeHostAuthority(readSingleHeader(req.headers.host))
  if (!effectiveHost) return false

  const rawOrigin = readSingleHeader(req.headers.origin)
  if (rawOrigin) {
    try {
      return normalizeHostAuthority(new URL(rawOrigin).host) === effectiveHost
    } catch {
      return false
    }
  }

  const rawReferer = readSingleHeader(req.headers.referer)
  if (rawReferer) {
    try {
      return normalizeHostAuthority(new URL(rawReferer).host) === effectiveHost
    } catch {
      return false
    }
  }

  return secFetchSite === "same-origin"
}

// 정적 페이지 재생성은 토큰 또는 관리자 세션으로 인증한 POST만 허용한다.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ message: "Method Not Allowed" })
  }

  const expectedSecret = process.env.TOKEN_FOR_REVALIDATE
  const headerSecret =
    typeof req.headers["x-revalidate-token"] === "string"
      ? req.headers["x-revalidate-token"]
      : ""
  const hasValidSecret = Boolean(expectedSecret) && safeTokenCompare(headerSecret, expectedSecret)
  const adminSession = hasValidSecret ? null : await fetchServerAdminSession(req)
  const isAdminRequest = adminSession?.isAdmin === true

  if (!hasValidSecret && !isAdminRequest) {
    return res.status(401).json({ message: "Invalid token or admin session required" })
  }

  if (!hasValidSecret && isAdminRequest && !isSameOriginSessionRequest(req)) {
    return res.status(403).json({ message: "Cross-origin session revalidation is forbidden" })
  }

  const pathFromQuery = typeof req.query.path === "string" ? req.query.path : ""
  const pathFromBody = typeof req.body?.path === "string" ? req.body.path : ""
  const pathsFromBody =
    Array.isArray(req.body?.paths)
      ? req.body.paths.filter((value: unknown): value is string => typeof value === "string")
      : []
  const targetPaths = [pathFromBody || pathFromQuery, ...pathsFromBody].filter((value) => value.trim().length > 0)

  const normalizedPaths = Array.from(new Set(
    (targetPaths.length > 0 ? targetPaths : ["/"])
      .map((path) => (path.startsWith("/") ? path : `/${path}`))
  ))

  if (normalizedPaths.length > MAX_REVALIDATE_PATHS_PER_CALL) {
    return res.status(400).json({
      message: `Too many revalidation paths requested (max ${MAX_REVALIDATE_PATHS_PER_CALL})`,
    })
  }

  try {
    invalidateServerSnapshotCache()
    await invalidatePublicPostReadCaches()

    // 상세·사이트맵·소개는 요청별 SSR이므로 재생성할 정적 산출물이 없다. 피드 무효화는 위에서 유지한다.
    const isDynamicSsrOnlyPath = (path: string) =>
      path.startsWith("/posts/") || path === "/sitemap.xml" || path === "/about"
    const dynamicPaths = normalizedPaths.filter(isDynamicSsrOnlyPath)
    const paths = normalizedPaths.filter((path) => !dynamicPaths.includes(path))

    const results = await Promise.allSettled(paths.map((path) => res.revalidate(path)))
    const revalidatedPaths: string[] = []
    const failedPaths: string[] = []

    results.forEach((result, index) => {
      const targetPath = paths[index]
      if (result.status === "fulfilled") {
        revalidatedPaths.push(targetPath)
        return
      }
      failedPaths.push(targetPath)
      console.error("[api/revalidate] path failed:", {
        path: targetPath,
        error: result.reason,
      })
    })

    if (paths.length > 0 && revalidatedPaths.length === 0) {
      return res.status(500).send("Error revalidating")
    }

    res.json({
      revalidated: revalidatedPaths.length > 0,
      count: revalidatedPaths.length,
      paths: revalidatedPaths,
      dynamicPaths,
      ...(failedPaths.length > 0 ? { failedPaths } : {}),
    })
  } catch (error) {
    // 실패를 로그로 남기지 않으면 재생성 실패가 stale 응답으로만 나타나 조용히 묻힌다.
    // 응답 본문에는 내부 정보를 담지 않고 서버 로그에만 남긴다.
    console.error("[api/revalidate] failed to revalidate:", {
      targetCount: targetPaths.length,
      error,
    })
    return res.status(500).send("Error revalidating")
  }
}
