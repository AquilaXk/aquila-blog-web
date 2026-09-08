import type { ProfileCardLinkItem } from "src/constants/profileCardLinks"
import type { BlogDesignType, LegacyBlogScheme } from "src/types"

export type AboutSectionBlock = {
  id: string
  title: string
  items: string[]
  dividerBefore: boolean
}

export type AboutProjectBlock = {
  id: string
  name: string
  summary: string
  role: string
  href: string
  linkLabel: string
}

export type ProfileWorkspaceContent = {
  profileImageUrl: string
  profileRole: string
  profileBio: string
  aboutHeadline: string
  aboutRole: string
  aboutBio: string
  aboutSections: AboutSectionBlock[]
  aboutProjectSectionTitle: string
  aboutProjects: AboutProjectBlock[]
  blogTitle: string
  homeIntroTitle: string
  homeIntroDescription: string
  blogDesign: BlogDesignType
  legacyBlogScheme: LegacyBlogScheme
  serviceLinks: ProfileCardLinkItem[]
  contactLinks: ProfileCardLinkItem[]
}

export type ProfileWorkspaceResponse = {
  draft: ProfileWorkspaceContent
  published: ProfileWorkspaceContent
  lastDraftSavedAt?: string | null
  lastPublishedAt?: string | null
  dirtyFromPublished: boolean
}

export const DEFAULT_ABOUT_HEADLINE = "이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다."
export const DEFAULT_ABOUT_PROJECT_SECTION_TITLE = "프로젝트"
export const normalizeBlogDesign = (_value: unknown): BlogDesignType => "legacy"
export const normalizeLegacyBlogScheme = (value: unknown): LegacyBlogScheme =>
  value === "light" ? "light" : "dark"
const normalizeLinkItems = (items: ProfileCardLinkItem[] | undefined): ProfileCardLinkItem[] =>
  (items || [])
    .map((item) => ({
      icon: item.icon,
      label: (item.label || "").trim(),
      href: (item.href || "").trim(),
    }))
    .filter((item) => item.label && item.href)

const normalizeAboutProjects = (items: AboutProjectBlock[] | undefined): AboutProjectBlock[] =>
  (items || [])
    .map((item, index) => {
      const href = (item.href || "").trim()
      const linkLabel = (item.linkLabel || "").trim()
      return {
        id: (item.id || "").trim() || `project-${index + 1}`,
        name: (item.name || "").trim(),
        summary: (item.summary || "").trim(),
        role: (item.role || "").trim(),
        href,
        linkLabel: linkLabel || (href ? "링크 보기" : ""),
      }
    })
    .filter((item) => item.name || item.summary || item.role || item.href)

export const normalizeProfileWorkspaceContent = (
  content: ProfileWorkspaceContent
): ProfileWorkspaceContent => {
  const normalizedSections = (content.aboutSections || [])
    .map((section, index) => ({
      id: (section.id || "").trim() || `section-${index + 1}`,
      title: (section.title || "").trim(),
      items: (section.items || []).map((item) => item.trim()).filter(Boolean),
      dividerBefore: Boolean(section.dividerBefore),
    }))
    .filter((section) => section.title || section.items.length > 0)
  const aboutProjects = normalizeAboutProjects(content.aboutProjects)
  const aboutSections = normalizedSections

  return {
    profileImageUrl: (content.profileImageUrl || "").trim(),
    profileRole: (content.profileRole || "").trim(),
    profileBio: (content.profileBio || "").trim(),
    aboutHeadline: (content.aboutHeadline || "").trim(),
    aboutRole: (content.aboutRole || "").trim(),
    aboutBio: (content.aboutBio || "").trim(),
    aboutSections,
    aboutProjectSectionTitle: (content.aboutProjectSectionTitle || "").trim(),
    aboutProjects,
    blogTitle: (content.blogTitle || "").trim(),
    homeIntroTitle: (content.homeIntroTitle || "").trim(),
    homeIntroDescription: (content.homeIntroDescription || "").trim(),
    blogDesign: normalizeBlogDesign(content.blogDesign),
    legacyBlogScheme: normalizeLegacyBlogScheme(content.legacyBlogScheme),
    serviceLinks: normalizeLinkItems(content.serviceLinks),
    contactLinks: normalizeLinkItems(content.contactLinks),
  }
}

export const serializeProfileWorkspaceContent = (content: ProfileWorkspaceContent) =>
  JSON.stringify(normalizeProfileWorkspaceContent(content))
