// 참조 구현: pacocoursey/cmdk (MIT), payloadcms/payload CommandPalette (MIT), github/hotkey (MIT) — 단일 패스 토큰 매처·그룹·아이콘 모델
import type { AdminCoreIconName } from "./AdminAppIcon"
import type { SiteLanguage } from "src/libs/language"

export type AdminPaletteActionId =
  | "nav-hub"
  | "nav-dashboard"
  | "nav-posts"
  | "nav-write"
  | "nav-cloud"
  | "nav-profile"
  | "nav-tools"
  | "view-blog"
  | "toggle-language"

export type AdminPaletteGroup = "navigation" | "actions"

export type AdminPaletteItem = {
  id: AdminPaletteActionId
  group?: AdminPaletteGroup
  icon?: AdminCoreIconName
  label: string
  subLabel?: string
  shortcut?: string
  href?: string
  action?: () => void
  keywords: string[]
  searchableLower?: string
}

export {
  isEditableElement,
  SequenceHotkeyStateMachine,
} from "./AdminSequenceHotkey"

// ASCII 공백 판별 정적 128B 테이블 (0x09~0x0D, 0x20)
const ASCII_WS_TABLE = (() => {
  const table = new Uint8Array(128)
  table[9] = 1
  table[10] = 1
  table[11] = 1
  table[12] = 1
  table[13] = 1
  table[32] = 1
  return table
})()

const isWhitespaceCode = (code: number): boolean =>
  code < 128 ? ASCII_WS_TABLE[code] === 1 : code === 0x00a0 || code === 0x3000

const buildSearchableLower = (item: AdminPaletteItem): string => {
  if (item.searchableLower !== undefined) return item.searchableLower
  const built = `${item.label} ${item.subLabel || ""} ${item.keywords.join(" ")}`.toLowerCase()
  item.searchableLower = built
  return built
}

/**
 * 정규식 split/filter 배열 할당 없이 단일 패스로 질의 토큰 스팬을 순회하며 매칭한다.
 */
export const matchPaletteItem = (
  item: AdminPaletteItem,
  query: string
): boolean => {
  const qLen = query.length
  if (qLen === 0) return true

  const haystack = buildSearchableLower(item)
  const lowerQuery = query.toLowerCase()
  let index = 0

  while (index < lowerQuery.length) {
    while (index < lowerQuery.length && isWhitespaceCode(lowerQuery.charCodeAt(index))) {
      index += 1
    }
    if (index >= lowerQuery.length) break
    const tokenStart = index
    while (index < lowerQuery.length && !isWhitespaceCode(lowerQuery.charCodeAt(index))) {
      index += 1
    }
    const token =
      tokenStart === 0 && index === lowerQuery.length
        ? lowerQuery
        : lowerQuery.slice(tokenStart, index)
    if (!haystack.includes(token)) {
      return false
    }
  }

  return true
}

export const filterPaletteItems = (
  items: AdminPaletteItem[],
  query: string
): AdminPaletteItem[] => {
  if (!query) return items
  let hasNonWs = false
  for (let i = 0; i < query.length; i += 1) {
    if (!isWhitespaceCode(query.charCodeAt(i))) {
      hasNonWs = true
      break
    }
  }
  if (!hasNonWs) return items
  return items.filter((item) => matchPaletteItem(item, query))
}

export const clampSelectedIndex = (
  currentIndex: number,
  delta: number,
  totalItems: number
): number => {
  if (totalItems <= 0) return 0
  const next = currentIndex + delta
  if (next < 0) return totalItems - 1
  if (next >= totalItems) return 0
  return next
}

const withPrecomputedIndex = (items: AdminPaletteItem[]): AdminPaletteItem[] => {
  for (let i = 0; i < items.length; i += 1) {
    buildSearchableLower(items[i])
  }
  return items
}

export const getAdminPaletteItems = (
  language: SiteLanguage,
  toggleLanguage: () => void
): AdminPaletteItem[] =>
  withPrecomputedIndex([
    {
      id: "nav-write",
      group: "actions",
      icon: "file",
      label: language === "en" ? "New Post" : "새 글 작성",
      subLabel: language === "en" ? "Open distraction-free markdown studio" : "집중형 마크다운 스튜디오 열기",
      shortcut: "G N",
      href: "/admin/editor/new",
      keywords: ["new", "write", "작성", "새글", "에디터"],
    },
    {
      id: "nav-hub",
      group: "navigation",
      icon: "layout-dashboard",
      label: language === "en" ? "Hub" : "관리자 허브",
      subLabel: language === "en" ? "Overview & recent activity" : "전체 지표 및 최근 콘텐츠 요약",
      shortcut: "G H",
      href: "/admin",
      keywords: ["hub", "home", "허브", "메인"],
    },
    {
      id: "nav-posts",
      group: "navigation",
      icon: "edit",
      label: language === "en" ? "Posts" : "글 관리",
      subLabel: language === "en" ? "Manage published, draft & private posts" : "발행, 초안, 링크 공개, 비공개 글 관리",
      shortcut: "G P",
      href: "/admin/posts",
      keywords: ["posts", "articles", "글", "포스트", "목록"],
    },
    {
      id: "nav-cloud",
      group: "navigation",
      icon: "cloud",
      label: language === "en" ? "Cloud Media" : "클라우드 미디어",
      subLabel: language === "en" ? "Images, PDFs, videos & storage folders" : "이미지, 문서, 동영상 보관함",
      shortcut: "G C",
      href: "/admin/cloud",
      keywords: ["cloud", "media", "files", "assets", "클라우드", "미디어", "파일"],
    },
    {
      id: "nav-dashboard",
      group: "navigation",
      icon: "activity",
      label: language === "en" ? "Dashboard" : "운영 대시보드",
      subLabel: language === "en" ? "Service health, queue & live logs" : "서비스 상태, 작업 큐 및 실시간 로그",
      shortcut: "G D",
      href: "/admin/dashboard",
      keywords: ["dashboard", "ops", "대시보드", "운영", "지표"],
    },
    {
      id: "nav-tools",
      group: "navigation",
      icon: "wrench",
      label: language === "en" ? "Operations Tools" : "운영 도구",
      subLabel: language === "en" ? "DLQ replay, search flags & diagnostics" : "DLQ 재실행, 검색 플래그 및 복구 진단",
      shortcut: "G T",
      href: "/admin/tools",
      keywords: ["tools", "ops", "dlq", "도구", "복구", "진단"],
    },
    {
      id: "nav-profile",
      group: "navigation",
      icon: "settings",
      label: language === "en" ? "Profile Settings" : "프로필 설정",
      subLabel: language === "en" ? "Identity, About page & social links" : "계정 정보, 소개 페이지 및 외부 링크",
      shortcut: "G U",
      href: "/admin/profile",
      keywords: ["profile", "settings", "프로필", "설정", "소개"],
    },
    {
      id: "view-blog",
      group: "actions",
      icon: "globe",
      label: language === "en" ? "View Blog" : "블로그 보기",
      subLabel: language === "en" ? "Open public blog home" : "공개 블로그 홈으로 이동",
      href: "/",
      keywords: ["blog", "public", "view", "블로그", "홈"],
    },
    {
      id: "toggle-language",
      group: "actions",
      icon: "globe",
      label: language === "en" ? "한국어로 전환" : "Switch to English",
      subLabel: language === "en" ? "Switch admin interface language" : "관리자 인터페이스 언어 전환",
      action: toggleLanguage,
      keywords: ["language", "toggle", "english", "korean", "언어", "한글", "영어"],
    },
  ])
