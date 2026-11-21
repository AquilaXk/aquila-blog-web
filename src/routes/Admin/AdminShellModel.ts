// 참조 구현: TryGhost/Ghost (MIT) — 관리자 셸 네비게이션 모델 및 로그아웃 헬퍼
import { apiFetch } from "src/apis/backend/client"
import type { AdminCoreIconName } from "./AdminAppIcon"
import type { SiteLanguage } from "src/libs/language"
import { clearAllAdminEditorLocalDrafts, hasAdminEditorLocalDrafts } from "src/libs/privacy/browserStorageRegistry"
import { adminShellT } from "./adminShellI18n"
import type { AdminProfile } from "src/types/adminProfile"

export type AdminShellSection = "hub" | "dashboard" | "posts" | "cloud" | "profile" | "tools"

export type NavItem = {
  id: AdminShellSection | "write"
  href: string
  label: string
  shortLabel: string
  icon: AdminCoreIconName
}

export const getNavItems = (language: SiteLanguage): NavItem[] => [
  { id: "hub", href: "/admin", label: adminShellT("navHub", language), shortLabel: language === "en" ? "Hub" : "허브", icon: "layout-dashboard" },
  { id: "dashboard", href: "/admin/dashboard", label: adminShellT("navDashboard", language), shortLabel: language === "en" ? "Board" : "대시보드", icon: "activity" },
  { id: "posts", href: "/admin/posts", label: adminShellT("navPosts", language), shortLabel: language === "en" ? "Posts" : "글", icon: "edit" },
  { id: "write", href: "/admin/editor/new", label: adminShellT("navWrite", language), shortLabel: language === "en" ? "New" : "작성", icon: "file" },
  { id: "cloud", href: "/admin/cloud", label: adminShellT("navCloud", language), shortLabel: language === "en" ? "Cloud" : "클라우드", icon: "cloud" },
  { id: "tools", href: "/admin/tools", label: adminShellT("navTools", language), shortLabel: language === "en" ? "Tools" : "도구", icon: "wrench" },
  { id: "profile", href: "/admin/profile", label: adminShellT("navProfile", language), shortLabel: language === "en" ? "Profile" : "설정", icon: "settings" },
]

export const getSectionTitle = (section: AdminShellSection, language: SiteLanguage): string => {
  switch (section) {
    case "hub": return adminShellT("shellSectionHub", language)
    case "dashboard": return adminShellT("shellSectionDashboard", language)
    case "posts": return adminShellT("shellSectionPosts", language)
    case "cloud": return adminShellT("shellSectionCloud", language)
    case "profile": return adminShellT("shellSectionProfile", language)
    case "tools": return adminShellT("shellSectionTools", language)
    default: return ""
  }
}

export const resolveProfileStatusLabel = (
  isProfileError: boolean,
  isProfileLoading: boolean,
  profile: AdminProfile | null | undefined,
  language: SiteLanguage = "ko"
) => {
  if (isProfileError) return adminShellT("shellProfileError", language)
  if (isProfileLoading && !profile) return adminShellT("shellProfileLoading", language)
  return adminShellT("shellProfileRoleAdmin", language)
}

export const performAdminShellLogout = async ({
  hasUnsavedChanges,
  unsavedLogoutMessage,
  hasLocalDrafts = hasAdminEditorLocalDrafts(),
  confirmFn = (message: string) => (typeof window !== "undefined" ? window.confirm(message) : true),
  callLogout = () => apiFetch("/member/api/v1/auth/logout", { method: "DELETE" }),
  clearDrafts = () => clearAllAdminEditorLocalDrafts(),
  language = "ko",
}: {
  hasUnsavedChanges?: boolean
  unsavedLogoutMessage?: string
  hasLocalDrafts?: boolean
  confirmFn?: (message: string) => boolean
  callLogout?: () => Promise<unknown>
  clearDrafts?: () => void
  language?: SiteLanguage
}): Promise<boolean> => {
  if (hasUnsavedChanges || hasLocalDrafts) {
    const confirmMessage =
      unsavedLogoutMessage ||
      (hasUnsavedChanges
        ? adminShellT("shellLogoutConfirmUnsaved", language)
        : adminShellT("shellLogoutConfirmDraft", language))
    if (!confirmFn(confirmMessage)) {
      return false
    }
  }
  try {
    await Promise.resolve(callLogout()).catch(() => undefined)
  } finally {
    clearDrafts()
  }
  return true
}
