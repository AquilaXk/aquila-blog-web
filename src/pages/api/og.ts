// 참조 구현: satnaing/astro-paper (MIT) — 게시물 공유용 동적 OpenGraph 이미지 엔드포인트
import type { NextApiRequest, NextApiResponse } from "next"
import { CONFIG } from "site.config"
import { renderOgCardPngBuffer } from "src/libs/og/ogCardRenderer.server"
import { MAX_OG_RAW_QUERY_LENGTH, parseOgQueryParams } from "src/libs/og/ogUrl"

const OG_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const method = req.method?.toUpperCase() ?? ""
  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    res.setHeader("Cache-Control", "no-store")
    res.status(405).json({ error: "Method Not Allowed" })
    return
  }

  const rawUrl = req.url ?? ""
  const queryIndex = rawUrl.indexOf("?")
  const rawQueryLength = queryIndex >= 0 ? rawUrl.length - queryIndex - 1 : 0
  if (rawQueryLength > MAX_OG_RAW_QUERY_LENGTH) {
    res.setHeader("Cache-Control", "no-store")
    res.status(400).json({ error: "Query string exceeds maximum allowed length" })
    return
  }

  try {
    const params = parseOgQueryParams(req.query, CONFIG.blog.title || "AquilaLog")
    const pngBuffer = await renderOgCardPngBuffer(params)

    res.setHeader("Content-Type", "image/png")
    res.setHeader("Content-Length", String(pngBuffer.byteLength))
    res.setHeader("Cache-Control", OG_CACHE_CONTROL)
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.status(200)

    if (method === "HEAD") {
      res.end()
      return
    }

    res.send(pngBuffer)
  } catch {
    res.setHeader("Cache-Control", "no-store")
    res.status(500).json({ error: "Failed to generate OG image" })
  }
}
