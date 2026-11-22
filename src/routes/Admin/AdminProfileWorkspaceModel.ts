// 참조 구현: TryGhost/Ghost (MIT) & medusajs/medusa v2 (MIT) — 프로필·계정 설정 섹션 및 링크 검증 모델
import type { IconName } from "src/components/icons/AppIcon"
import {
  DEFAULT_CONTACT_ITEM_ICON,
  DEFAULT_SERVICE_ITEM_ICON,
  isAllowedProfileLinkHref,
  normalizeProfileLinkHref,
  type ProfileCardLinkItem,
  type ProfileCardLinkSection,
} from "src/constants/profileCardLinks"
import {
  type AboutProjectBlock,
  type AboutSectionBlock,
  normalizeProfileWorkspaceContent,
  type ProfileWorkspaceContent,
} from "src/libs/profileWorkspace"

export type WorkspaceSectionId = "identity" | "about" | "home" | "links"
export type LinkTab = "service" | "contact"
export type PreviewMode = "draft" | "published"

export const WORKSPACE_SECTIONS: {
  id: WorkspaceSectionId
  label: string
}[] = [
  {
    id: "identity",
    label: "기본 정보",
  },
  {
    id: "about",
    label: "소개 페이지",
  },
  {
    id: "home",
    label: "헤더 문구",
  },
  {
    id: "links",
    label: "외부 링크",
  },
]

const pickWorkspaceSectionContent = (
  content: ProfileWorkspaceContent,
  sectionId: WorkspaceSectionId
) => {
  switch (sectionId) {
    case "identity":
      return {
        profileImageUrl: content.profileImageUrl,
        profileRole: content.profileRole,
        profileBio: content.profileBio,
      }
    case "about":
      return {
        aboutHeadline: content.aboutHeadline,
        aboutRole: content.aboutRole,
        aboutBio: content.aboutBio,
        aboutSections: content.aboutSections,
        aboutProjectSectionTitle: content.aboutProjectSectionTitle,
        aboutProjects: content.aboutProjects,
      }
    case "home":
      return {
        blogTitle: content.blogTitle,
        homeIntroTitle: content.homeIntroTitle,
        homeIntroDescription: content.homeIntroDescription,
      }
    case "links":
      return {
        serviceLinks: content.serviceLinks,
        contactLinks: content.contactLinks,
      }
  }
}

export const serializeWorkspaceSection = (
  content: ProfileWorkspaceContent,
  sectionId: WorkspaceSectionId
) => JSON.stringify(pickWorkspaceSectionContent(normalizeProfileWorkspaceContent(content), sectionId))

export const areProfileLinksEqual = (
  a: readonly ProfileCardLinkItem[],
  b: readonly ProfileCardLinkItem[]
): boolean => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const itemA = a[i]
    const itemB = b[i]
    if (
      itemA.icon !== itemB.icon ||
      itemA.label !== itemB.label ||
      itemA.href !== itemB.href
    ) {
      return false
    }
  }
  return true
}

export const areAboutSectionsEqual = (
  a: readonly AboutSectionBlock[],
  b: readonly AboutSectionBlock[]
): boolean => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const secA = a[i]
    const secB = b[i]
    if (
      secA.title !== secB.title ||
      secA.dividerBefore !== secB.dividerBefore ||
      secA.items.length !== secB.items.length
    ) {
      return false
    }
    for (let j = 0; j < secA.items.length; j += 1) {
      if (secA.items[j] !== secB.items[j]) return false
    }
  }
  return true
}

export const areAboutProjectsEqual = (
  a: readonly AboutProjectBlock[],
  b: readonly AboutProjectBlock[]
): boolean => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const pA = a[i]
    const pB = b[i]
    if (
      pA.name !== pB.name ||
      pA.summary !== pB.summary ||
      pA.role !== pB.role ||
      pA.href !== pB.href ||
      pA.linkLabel !== pB.linkLabel
    ) {
      return false
    }
  }
  return true
}

export const isIdentitySectionDirty = (
  draft: ProfileWorkspaceContent,
  baseline: ProfileWorkspaceContent
): boolean =>
  draft.profileImageUrl !== baseline.profileImageUrl ||
  draft.profileRole !== baseline.profileRole ||
  draft.profileBio !== baseline.profileBio

export const isAboutSectionDirty = (
  draft: ProfileWorkspaceContent,
  baseline: ProfileWorkspaceContent
): boolean =>
  draft.aboutHeadline !== baseline.aboutHeadline ||
  draft.aboutRole !== baseline.aboutRole ||
  draft.aboutBio !== baseline.aboutBio ||
  draft.aboutProjectSectionTitle !== baseline.aboutProjectSectionTitle ||
  !areAboutSectionsEqual(draft.aboutSections, baseline.aboutSections) ||
  !areAboutProjectsEqual(draft.aboutProjects, baseline.aboutProjects)

export const isHomeSectionDirty = (
  draft: ProfileWorkspaceContent,
  baseline: ProfileWorkspaceContent
): boolean =>
  draft.blogTitle !== baseline.blogTitle ||
  draft.homeIntroTitle !== baseline.homeIntroTitle ||
  draft.homeIntroDescription !== baseline.homeIntroDescription

export const isLinksSectionDirty = (
  draft: ProfileWorkspaceContent,
  baseline: ProfileWorkspaceContent
): boolean =>
  !areProfileLinksEqual(draft.serviceLinks, baseline.serviceLinks) ||
  !areProfileLinksEqual(draft.contactLinks, baseline.contactLinks)

export const computeProfileDirtyMask = (
  normalizedDraft: ProfileWorkspaceContent,
  normalizedBaseline: ProfileWorkspaceContent
): number => {
  let mask = 0
  if (isIdentitySectionDirty(normalizedDraft, normalizedBaseline)) mask |= 1 << 0
  if (isAboutSectionDirty(normalizedDraft, normalizedBaseline)) mask |= 1 << 1
  if (isHomeSectionDirty(normalizedDraft, normalizedBaseline)) mask |= 1 << 2
  if (isLinksSectionDirty(normalizedDraft, normalizedBaseline)) mask |= 1 << 3
  return mask
}

export const moveListItem = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const next = items.slice()
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next
}

const createLocalId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

export const createBlankLinkItem = (section: LinkTab): ProfileCardLinkItem =>
  section === "service"
    ? { icon: DEFAULT_SERVICE_ITEM_ICON, label: "", href: "" }
    : { icon: DEFAULT_CONTACT_ITEM_ICON, label: "", href: "" }

export const createBlankAboutSection = (): AboutSectionBlock => ({
  id: createLocalId("about"),
  title: "",
  items: [""],
  dividerBefore: false,
})

export const createBlankAboutProject = (): AboutProjectBlock => ({
  id: createLocalId("project"),
  name: "",
  summary: "",
  role: "",
  href: "",
  linkLabel: "",
})

export const reorderListItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return items
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items
  }

  const next = items.slice()
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export const validateLinkInputs = (
  section: ProfileCardLinkSection,
  sectionLabel: string,
  items: ProfileCardLinkItem[]
): string | null => {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const label = item.label.trim()
    const href = item.href.trim()
    const rowLabel = `${sectionLabel} ${index + 1}번 링크`

    if (!label && !href) {
      return `${rowLabel}이 비어 있습니다. 입력하거나 삭제해주세요.`
    }
    if (!label || !href) {
      return `${rowLabel}은 이름과 연결 주소를 모두 입력해야 합니다.`
    }
    if (!isAllowedProfileLinkHref(section, href)) {
      if (section === "service") {
        return `${rowLabel} 주소는 https:// 또는 http:// 형식만 허용됩니다.`
      }
      return `${rowLabel} 주소는 https://, http://, mailto:, tel: 형식만 허용됩니다.`
    }
  }

  return null
}

const getDefaultLinkIcon = (section: ProfileCardLinkSection): IconName =>
  section === "service" ? DEFAULT_SERVICE_ITEM_ICON : DEFAULT_CONTACT_ITEM_ICON

export const toPayloadLinks = (
  section: ProfileCardLinkSection,
  items: ProfileCardLinkItem[]
): ProfileCardLinkItem[] =>
  items
    .map((item) => ({
      icon: item.icon || getDefaultLinkIcon(section),
      label: item.label.trim(),
      href: normalizeProfileLinkHref(section, item.href),
    }))
    .filter((item) => item.label && item.href)
