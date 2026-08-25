import type { ProfileCardLinkItem } from "src/constants/profileCardLinks"
import type { AboutProjectBlock, AboutSectionBlock } from "src/libs/profileWorkspace"
import type { BlogDesignType, LegacyBlogScheme } from "src/types"

export type AdminProfile = {
  username: string
  name: string
  nickname: string
  modifiedAt?: string
  profileImageUrl: string
  profileImageDirectUrl?: string
  profileRole?: string
  profileBio?: string
  aboutHeadline?: string
  aboutRole?: string
  aboutBio?: string
  aboutDetails?: string
  aboutSections?: AboutSectionBlock[]
  aboutProjectSectionTitle?: string
  aboutProjects?: AboutProjectBlock[]
  blogTitle?: string
  homeIntroTitle?: string
  homeIntroDescription?: string
  blogDesign?: BlogDesignType
  legacyBlogScheme?: LegacyBlogScheme
  serviceLinks?: ProfileCardLinkItem[]
  contactLinks?: ProfileCardLinkItem[]
}
