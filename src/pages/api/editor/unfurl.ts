import type { NextApiRequest, NextApiResponse } from "next"
import {
  extractUnfurlMetadata,
  inferLinkProvider,
  resolveEmbedPreviewUrl,
} from "src/libs/unfurl/extractMeta"
import { normalizePublicExternalThumbnailUrl } from "src/libs/markdown/externalThumbnailUrlPolicy"
import {
  fetchSafeUnfurlResponse,
  MAX_UNFURL_RESPONSE_BYTES,
  normalizeSafeUnfurlUrl,
  UnfurlResponseTooLargeError,
  UnfurlUnsupportedEncodingError,
  UnfurlUpstreamRedirectError,
  UnfurlValidationError,
} from "src/libs/unfurl/requestSafety"
import { fetchServerAdminSession } from "src/libs/server/authSession"
import { shouldBypassAdminGuardForQa } from "src/libs/server/adminGuard"

const QA_UNFURL_FIXTURES: Record<
  string,
  {
    title: string
    description: string
    siteName: string
    provider: string
    thumbnailUrl: string
    embedUrl?: string
  }
> = {
  "https://github.com/aquilaxk/aquila-blog": {
    title: "aquila-blog",
    description: "에디터 개선 로그와 블로그 서비스를 담은 저장소",
    siteName: "GitHub",
    provider: "GitHub",
    thumbnailUrl: "https://opengraph.githubassets.com/aquila-blog.png",
  },
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ": {
    title: "Never Gonna Give You Up",
    description: "테스트용 고정 임베드 메타데이터",
    siteName: "YouTube",
    provider: "YouTube",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
}

const createError = (status: number, message: string) => ({
  status,
  body: {
    ok: false as const,
    message,
  },
})

const resolveOembedEndpoint = (parsedUrl: URL): string | null => {
  const host = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase()
  const encoded = encodeURIComponent(parsedUrl.toString())
  if (host === "youtube.com" || host === "youtu.be") {
    return `https://www.youtube.com/oembed?url=${encoded}&format=json`
  }
  if (host === "vimeo.com") {
    return `https://vimeo.com/api/oembed.json?url=${encoded}`
  }
  if (host === "codepen.io") {
    return `https://codepen.io/api/oembed?format=json&url=${encoded}`
  }
  return null
}

export const tryFetchOembedMetadata = async (
  parsedUrl: URL,
  signal: AbortSignal
) => {
  const oembedEndpoint = resolveOembedEndpoint(parsedUrl)
  if (!oembedEndpoint) return null
  try {
    const { response } = await fetchSafeUnfurlResponse({
      initialUrl: oembedEndpoint,
      signal,
      stopAtHeadEnd: false,
      headers: {
        Accept: "application/json",
        "User-Agent": "aquila-editor-unfurl/1.0",
      },
    })
    if (!response.ok) return null
    const payload = JSON.parse(await response.text()) as Record<string, unknown>
    const title = typeof payload.title === "string" ? payload.title.trim() : ""
    if (!title) return null
    const rawThumb = typeof payload.thumbnail_url === "string" ? payload.thumbnail_url.trim() : ""
    const rawProvider = typeof payload.provider_name === "string" ? payload.provider_name.trim() : ""
    const rawAuthor = typeof payload.author_name === "string" ? payload.author_name.trim() : ""
    const embedUrl = resolveEmbedPreviewUrl(parsedUrl.toString())
    return {
      url: parsedUrl.toString(),
      title,
      description: rawAuthor ? `${rawAuthor}` : "",
      siteName: rawProvider || inferLinkProvider(parsedUrl.toString()),
      provider: rawProvider || inferLinkProvider(parsedUrl.toString()),
      thumbnailUrl: rawThumb ? normalizePublicExternalThumbnailUrl(rawThumb, parsedUrl.toString()) : "",
      ...(embedUrl ? { embedUrl } : {}),
    }
  } catch (error) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? (error as { name?: unknown }).name
        : undefined
    const isAbortError =
      signal.aborted ||
      errorName === "AbortError" ||
      errorName === "TimeoutError"
    if (isAbortError) {
      throw error
    }
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ ok: false, message: "허용되지 않은 메서드입니다." })
  }

  if (!shouldBypassAdminGuardForQa()) {
    const adminSession = await fetchServerAdminSession(req)
    if (adminSession?.isAdmin !== true) {
      return res.status(401).json({ ok: false, message: "관리자 세션이 필요합니다." })
    }
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url
  const targetUrl = String(rawUrl || "").trim()
  if (!targetUrl) {
    return res.status(400).json({ ok: false, message: "URL이 비어 있습니다." })
  }

  try {
    const parsedUrl = normalizeSafeUnfurlUrl(targetUrl)

    if (process.env.ENABLE_QA_ROUTES === "true") {
      const fixture = QA_UNFURL_FIXTURES[parsedUrl.toString()]
      if (fixture) {
        return res.status(200).json({
          ok: true,
          data: {
            url: parsedUrl.toString(),
            ...fixture,
          },
        })
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const oembedMetadata = await tryFetchOembedMetadata(parsedUrl, controller.signal)
      if (oembedMetadata) {
        return res.status(200).json({ ok: true, data: oembedMetadata })
      }

      const { response, finalUrl } = await fetchSafeUnfurlResponse({
        initialUrl: parsedUrl.toString(),
        signal: controller.signal,
        stopAtHeadEnd: true,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "aquila-editor-unfurl/1.0",
        },
      })

      if (!response.ok) {
        const { status, body } = createError(502, `unfurl 대상 응답이 비정상적입니다. (${response.status})`)
        return res.status(status).json(body)
      }

      const contentType = response.headers.get("content-type") || ""
      const mediaType = contentType.split(";", 1)[0].trim().toLowerCase()
      if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
        const { status, body } = createError(415, "HTML 문서만 unfurl할 수 있습니다.")
        return res.status(status).json(body)
      }

      const html = (await response.text()).slice(0, MAX_UNFURL_RESPONSE_BYTES)
      const metadata = extractUnfurlMetadata(finalUrl.toString(), html)
      return res.status(200).json({ ok: true, data: metadata })
    } catch (error) {
      if (error instanceof UnfurlResponseTooLargeError) {
        const { status, body } = createError(413, "unfurl 대상 응답 크기가 제한을 초과했습니다.")
        return res.status(status).json(body)
      }
      if (error instanceof UnfurlValidationError) {
        return res.status(400).json({ ok: false, message: error.message })
      }
      if (error instanceof UnfurlUnsupportedEncodingError) {
        const { status, body } = createError(415, "지원하지 않는 응답 인코딩입니다.")
        return res.status(status).json(body)
      }
      if (error instanceof UnfurlUpstreamRedirectError) {
        const { status, body } = createError(502, "리다이렉트 처리 중 오류가 발생했습니다.")
        return res.status(status).json(body)
      }
      const { status, body } = createError(504, "링크 메타데이터를 불러오지 못했습니다.")
      return res.status(status).json(body)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL 형식이 올바르지 않습니다."
    return res.status(400).json({ ok: false, message })
  }
}
