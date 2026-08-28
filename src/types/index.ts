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
  date: { start_date: string }
  type: TPostType[]
  slug: string
  tags?: string[]
  category?: string[]
  summary?: string
  summarySource?: PostSummarySource
  author?: {
    id: string
    name: string
    profile_photo?: string
  }[]
  title: string
  status: TPostStatus[]
  createdTime: string
  modifiedTime?: string
  fullWidth: boolean
  thumbnail?: string
  likesCount?: number
  hitCount?: number
  actorCanModify?: boolean
  actorCanDelete?: boolean
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
