// 참조 구현: TryGhost/Ghost (MIT) — 관리자 공통 셸 경량 한/영 사전 (초기 번들 분리)
import type { SiteLanguage } from "src/libs/language"

export type AdminShellI18nKey =
  | "navHub"
  | "navDashboard"
  | "navPosts"
  | "navWrite"
  | "navCloud"
  | "navTools"
  | "navProfile"
  | "shellSectionHub"
  | "shellSectionDashboard"
  | "shellSectionPosts"
  | "shellSectionCloud"
  | "shellSectionProfile"
  | "shellSectionTools"
  | "shellViewBlog"
  | "shellNewPost"
  | "shellQuickNavAria"
  | "shellLogoutAria"
  | "shellProfileRoleAdmin"
  | "shellProfileError"
  | "shellProfileLoading"
  | "shellLogoutConfirmUnsaved"
  | "shellLogoutConfirmDraft"

export const ADMIN_SHELL_TRANSLATIONS: Record<
  SiteLanguage,
  Record<AdminShellI18nKey, string>
> = {
  ko: {
    navHub: "허브",
    navDashboard: "운영 대시보드",
    navPosts: "글 관리",
    navWrite: "새 글 작성",
    navCloud: "클라우드",
    navTools: "운영 도구",
    navProfile: "프로필",
    shellSectionHub: "관리자 허브",
    shellSectionDashboard: "운영 대시보드",
    shellSectionPosts: "글 관리",
    shellSectionCloud: "클라우드",
    shellSectionProfile: "설정",
    shellSectionTools: "운영 도구",
    shellViewBlog: "블로그 보기",
    shellNewPost: "새 글",
    shellQuickNavAria: "관리자 바로가기",
    shellLogoutAria: "로그아웃",
    shellProfileRoleAdmin: "관리자",
    shellProfileError: "프로필 정보를 불러올 수 없습니다.",
    shellProfileLoading: "프로필 정보를 불러오는 중입니다.",
    shellLogoutConfirmUnsaved:
      "저장되지 않은 변경 사항이 있습니다. 로그아웃하면 변경 내용과 브라우저 임시 초안이 사라질 수 있습니다. 계속 로그아웃할까요?",
    shellLogoutConfirmDraft:
      "브라우저에 임시 저장된 글 초안이 있습니다. 로그아웃하면 임시 초안이 삭제됩니다. 계속 로그아웃할까요?",
  },
  en: {
    navHub: "Hub",
    navDashboard: "Dashboard",
    navPosts: "Posts",
    navWrite: "New Post",
    navCloud: "Cloud",
    navTools: "Tools",
    navProfile: "Profile",
    shellSectionHub: "Admin Hub",
    shellSectionDashboard: "Dashboard",
    shellSectionPosts: "Posts",
    shellSectionCloud: "Cloud",
    shellSectionProfile: "Settings",
    shellSectionTools: "Tools",
    shellViewBlog: "View Blog",
    shellNewPost: "New Post",
    shellQuickNavAria: "Admin quick navigation",
    shellLogoutAria: "Logout",
    shellProfileRoleAdmin: "Admin",
    shellProfileError: "Failed to load profile info.",
    shellProfileLoading: "Loading profile info...",
    shellLogoutConfirmUnsaved:
      "You have unsaved changes. Logging out may discard your changes and browser draft. Continue?",
    shellLogoutConfirmDraft:
      "You have a temporary draft saved in your browser. Logging out will clear it. Continue?",
  },
}

export const adminShellT = (
  key: AdminShellI18nKey,
  language: SiteLanguage = "ko"
): string => ADMIN_SHELL_TRANSLATIONS[language]?.[key] ?? ADMIN_SHELL_TRANSLATIONS.ko[key]
