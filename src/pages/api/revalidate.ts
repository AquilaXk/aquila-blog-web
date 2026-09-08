import { NextApiRequest, NextApiResponse } from "next"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import { fetchServerAdminSession } from "src/libs/server/authSession"

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
  const hasValidSecret = Boolean(expectedSecret) && headerSecret === expectedSecret
  const adminSession = hasValidSecret ? null : await fetchServerAdminSession(req)
  const isAdminRequest = adminSession?.isAdmin === true

  if (!hasValidSecret && !isAdminRequest) {
    return res.status(401).json({ message: "Invalid token or admin session required" })
  }

  const pathFromQuery = typeof req.query.path === "string" ? req.query.path : ""
  const pathFromBody = typeof req.body?.path === "string" ? req.body.path : ""
  const pathsFromBody =
    Array.isArray(req.body?.paths)
      ? req.body.paths.filter((value: unknown): value is string => typeof value === "string")
      : []
  const targetPaths = [pathFromBody || pathFromQuery, ...pathsFromBody].filter((value) => value.trim().length > 0)

  try {
    await invalidatePublicPostReadCaches()

    const normalizedPaths = Array.from(new Set(
      (targetPaths.length > 0 ? targetPaths : ["/"])
        .map((path) => path.startsWith("/") ? path : `/${path}`)
    ))
    // 상세는 요청별 SSR이므로 재생성할 정적 산출물이 없다. 피드 무효화는 위에서 유지한다.
    const dynamicPaths = normalizedPaths.filter((path) => /^\/posts\/[1-9]\d*\/?$/.test(path))
    const paths = normalizedPaths.filter((path) => !dynamicPaths.includes(path))
    await Promise.all(paths.map((path) => res.revalidate(path)))

    res.json({
      revalidated: paths.length > 0,
      count: paths.length,
      paths,
      dynamicPaths,
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
