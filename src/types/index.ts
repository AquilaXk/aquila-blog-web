import { NextPage } from "next"
import { AppProps } from "next/app"
import { EmotionCache } from "@emotion/cache"
import { ReactElement, ReactNode } from "react"
import type { components } from "@shared/contracts"

// TODO: refactor types
export type NextPageWithLayout<PageProps = {}> = NextPage<PageProps> & {
  getLayout?: (page: ReactElement) => ReactNode
}

export type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
  emotionCache?: EmotionCache
}

export type TPostStatus = "Private" | "Public" | "PublicOnDetail"
export type TPostType = "Post" | "Paper" | "Page"
export type PostSummarySource = NonNullable<
  components["schemas"]["PostDto"]["summarySource"]
> & NonNullable<components["schemas"]["PostWithContentDto"]["summarySource"]>

export type TPost = {
  id: string
  title: string
  slug: string
  createdAt?: string
  modifiedAt?: string
  published?: boolean
  listed?: boolean
  authorId?: number
  authorName?: string
  authorUsername?: string
  authorProfileImgUrl?: string
  thumbnail?: string
  summary?: string
  summarySource?: PostSummarySource
  tags?: string[]
  category?: string[]
  likesCount?: number
  hitCount?: number
  actorCanModify?: boolean
  actorCanDelete?: boolean

  // Legacy Notion schema compatibility fields
  date?: { start_date: string }
  type?: TPostType[]
  status?: TPostStatus[]
  author?: {
    id: string
    name: string
    profile_photo?: string
  }[]
  createdTime?: string
  modifiedTime?: string
  fullWidth?: boolean
}

export type TrustedContentHtml = {
  readonly kind: "trusted-content-html"
  readonly html: string
}

export type PostDetail = TPost & {
  content: string
  trustedContentHtml?: TrustedContentHtml
}

export type TPosts = TPost[]

export type TTags = {
  [tagName: string]: number
}
export type TCategories = {
  [category: string]: number
}

export type SchemeType = "light" | "dark"
export type BlogDesignType = "legacy"
export type LegacyBlogScheme = "light" | "dark"
export type { RsData, PostVisibility } from "./api"

