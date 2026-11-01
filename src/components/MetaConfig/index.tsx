import { CONFIG } from "site.config"
import Head from "next/head"
import {
  hasAsciiControlCharacters,
  normalizeSafeRelativeMarkdownPath,
} from "src/libs/markdown/safeMarkdownUrl"

export type MetaConfigProps = {
  title: string
  description: string
  type: "Website" | "Post" | "Page" | string
  date?: string
  modifiedDate?: string
  image?: string
  url: string
  robots?: string
  canonicalUrl?: string | null
  jsonLd?: Array<Record<string, unknown>>
  siteName?: string
}

const SITE_TITLE = CONFIG.blog.title || "AquilaLog"

const trimTrailingSlashes = (value: string): string => {
  let end = value.length
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1
  }
  return value.slice(0, end)
}

const resolveBrowserTabTitle = (title: string, siteName: string) => {
  const pageTitle = title.trim()
  if (!pageTitle || pageTitle === siteName) {
    return siteName
  }
  if (
    pageTitle.endsWith(` | ${siteName}`) ||
    pageTitle.endsWith(` - ${siteName}`)
  ) {
    return pageTitle
  }

  return `${pageTitle} | ${siteName}`
}

export const resolveOpenGraphType = (type: string | undefined): "article" | "website" => {
  const normalized = (type || "").trim().toLowerCase()
  return normalized === "post" || normalized === "paper" || normalized === "article"
    ? "article"
    : "website"
}

export const sanitizeMetadataImageUrl = (rawImage: string | undefined): string => {
  const rawWithoutFragment = (rawImage ?? "").split("#")[0] ?? ""
  const withoutFragment = rawWithoutFragment.trim()
  if (!withoutFragment || hasAsciiControlCharacters(withoutFragment)) {
    return ""
  }

  if (withoutFragment.startsWith("/")) {
    return normalizeSafeRelativeMarkdownPath(withoutFragment)
  }

  try {
    const parsed = new URL(withoutFragment)
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return ""
    }
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return ""
  }
}

export const resolveMetadataImageUrl = (
  rawImage: string | undefined,
  siteUrl: string = CONFIG.link
): string => {
  const sanitized = sanitizeMetadataImageUrl(rawImage)
  if (!sanitized) return ""

  if (sanitized.startsWith("/")) {
    const baseOrigin = trimTrailingSlashes(siteUrl.trim())
    if (!baseOrigin) return ""
    try {
      const resolved = new URL(sanitized, `${baseOrigin}/`)
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return ""
      resolved.hash = ""
      return resolved.toString()
    } catch {
      return ""
    }
  }

  return sanitized
}

const serializeJsonLd = (value: Record<string, unknown>) =>
  JSON.stringify(value).replace(/</g, "\\u003c")

const MetaConfig: React.FC<MetaConfigProps> = (props) => {
  const siteName = props.siteName?.trim() || SITE_TITLE
  const browserTabTitle = resolveBrowserTabTitle(props.title, siteName)
  const robots = props.robots || "follow, index"
  const canonicalUrl =
    props.canonicalUrl === undefined ? props.url : props.canonicalUrl
  const ogType = resolveOpenGraphType(props.type)
  const resolvedImage = sanitizeMetadataImageUrl(props.image)

  return (
    <Head>
      <title>{browserTabTitle}</title>
      <meta name="robots" content={robots} />
      <meta charSet="UTF-8" />
      <meta name="description" content={props.description} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={props.title} />
      <meta property="og:description" content={props.description} />
      <meta property="og:url" content={props.url} />
      <meta property="og:site_name" content={siteName} />
      {CONFIG.lang && <meta property="og:locale" content={CONFIG.lang} />}
      {resolvedImage && <meta property="og:image" content={resolvedImage} />}
      <meta name="twitter:title" content={props.title} />
      <meta name="twitter:description" content={props.description} />
      <meta name="twitter:card" content="summary_large_image" />
      {resolvedImage && <meta name="twitter:image" content={resolvedImage} />}
      {ogType === "article" && (
        <>
          {props.date && (
            <meta property="article:published_time" content={props.date} />
          )}
          {props.modifiedDate && (
            <meta
              property="article:modified_time"
              content={props.modifiedDate}
            />
          )}
          <meta property="article:author" content={CONFIG.profile.name} />
        </>
      )}
      {props.jsonLd?.map((entry, index) => (
        <script
          key={`json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(entry) }}
        />
      ))}
    </Head>
  )
}

export default MetaConfig
