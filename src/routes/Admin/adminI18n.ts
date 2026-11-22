// 참조 구현: TryGhost/Ghost (MIT) & payloadcms/payload (MIT) — 관리자 인터페이스 한/영 사전 헬퍼
import type { SiteLanguage } from "src/libs/language"
import { ADMIN_EDITOR_TRANSLATIONS, type AdminEditorI18nKey } from "./adminEditorI18n"

export type AdminBaseI18nKey =
  | "navHub"
  | "navDashboard"
  | "navPosts"
  | "navWrite"
  | "navCloud"
  | "navTools"
  | "navProfile"
  | "filterAll"
  | "filterDraft"
  | "filterPublished"
  | "filterPrivate"
  | "filterDeleted"
  | "actionPublishListed"
  | "actionUnpublishPrivate"
  | "actionDelete"
  | "actionRestore"
  | "actionHardDelete"
  | "bulkSelectedCount"
  | "bulkClearSelection"
  // Shell
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
  // Login
  | "loginTitle"
  | "loginSubtitleRequest"
  | "loginSubtitleVerify"
  | "loginOtpHint"
  | "loginFieldsAria"
  | "loginEmail"
  | "loginSaveEmail"
  | "loginKeepSignedIn"
  | "loginCode"
  | "loginRemainingTime"
  | "loginReenterEmail"
  | "loginResendCode"
  | "loginBackToBlog"
  | "loginSubmitRequest"
  | "loginSubmitVerify"
  | "loginSubmitExpired"
  | "loginVerifying"
  | "loginNavigating"
  | "loginCodeExpired"
  | "loginSendingCode"
  | "loginCodeSent"
  | "loginCheckingCode"
  | "loginOpeningAdmin"
  | "loginEmailRequired"
  | "loginInvalidEmail"
  | "loginRequestCodeFirst"
  | "loginCodeRequired8Digits"
  | "loginAdminRequired"
  | "loginResendCooldown"
  | "loginSessionTerminateFailed"
  | "loginSessionVerifyFailed"
  | "loginNonAdminSessionFailed"
  // Posts Workspace Filters & Table
  | "postsSearchPlaceholder"
  | "postsSearchAria"
  | "postsClearSearchAria"
  | "sortRecentlyUpdated"
  | "sortNewestFirst"
  | "sortOldestFirst"
  | "sortMostViewed"
  | "sortMostLiked"
  | "filterReset"
  | "tableColCheckbox"
  | "tableColTitle"
  | "tableColTopic"
  | "tableColStatus"
  | "tableColDate"
  | "tableColCreatedDate"
  | "tableColViews"
  | "tableColActions"
  | "tableSelectAllAria"
  | "tableEmptyTitle"
  | "tableEmptyDesc"
  | "tableEmptyAction"
  | "tableSearchEmptyTitle"
  | "tableSearchEmptyDesc"
  | "tableSearchEmptyAction"
  | "tableErrorTitle"
  | "tableErrorAction"
  | "tableLoadingAria"
  | "paginationPageAria"
  | "paginationPrev"
  | "paginationNext"
  // Dashboard Content KPI
  | "kpiContentStatus"
  | "kpiEngagement"
  | "kpiTotalPosts"
  | "kpiViews"
  | "kpiLikes"
  | "kpiPublished"
  | "kpiDraft"
  | "kpiPrivate"

export type AdminI18nKey = AdminBaseI18nKey | AdminEditorI18nKey

const ADMIN_BASE_TRANSLATIONS: Record<SiteLanguage, Record<AdminBaseI18nKey, string>> = {
  ko: {
    navHub: "허브",
    navDashboard: "운영 대시보드",
    navPosts: "글 관리",
    navWrite: "새 글 작성",
    navCloud: "클라우드",
    navTools: "운영 도구",
    navProfile: "프로필",
    filterAll: "전체",
    filterDraft: "초안",
    filterPublished: "발행",
    filterPrivate: "비공개",
    filterDeleted: "삭제됨",
    actionPublishListed: "전체 공개 전환",
    actionUnpublishPrivate: "비공개 전환",
    actionDelete: "일괄 삭제",
    actionRestore: "일괄 복구",
    actionHardDelete: "일괄 영구삭제",
    bulkSelectedCount: "개 선택됨",
    bulkClearSelection: "선택 해제",
    // Shell
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
    // Login
    loginTitle: "관리자 로그인",
    loginSubtitleRequest: "등록된 관리자 이메일로 일회용 인증 코드를 보냅니다.",
    loginSubtitleVerify: "이메일로 전송된 8자리 일회용 인증 코드를 입력하세요.",
    loginOtpHint: "숫자 8자리 일회용 인증 코드",
    loginFieldsAria: "관리자 로그인 입력",
    loginEmail: "이메일",
    loginSaveEmail: "이메일 저장",
    loginKeepSignedIn: "로그인 유지",
    loginCode: "인증 코드",
    loginRemainingTime: "남은 시간",
    loginReenterEmail: "이메일 다시 입력",
    loginResendCode: "인증 코드 재전송",
    loginBackToBlog: "블로그로 돌아가기",
    loginSubmitRequest: "인증 코드 받기",
    loginSubmitVerify: "로그인",
    loginSubmitExpired: "인증 코드 만료됨",
    loginVerifying: "확인 중...",
    loginNavigating: "관리자 페이지 여는 중...",
    loginCodeExpired: "인증 코드가 만료되었습니다. 새 코드를 요청해주세요.",
    loginSendingCode: "인증 코드를 전송하고 있습니다.",
    loginCodeSent: "인증 코드를 보냈습니다.",
    loginCheckingCode: "인증 코드를 확인하고 있습니다.",
    loginOpeningAdmin: "관리자 페이지를 열고 있습니다.",
    loginEmailRequired: "이메일을 입력해주세요.",
    loginInvalidEmail: "이메일 형식을 확인해주세요.",
    loginRequestCodeFirst: "새 인증 코드를 요청해주세요.",
    loginCodeRequired8Digits: "8자리 인증 코드를 입력해주세요.",
    loginAdminRequired: "관리자 권한이 필요한 페이지입니다.",
    loginResendCooldown: "재전송 쿨다운",
    loginSessionTerminateFailed: "관리자 세션을 종료하지 못했습니다. 새 코드를 요청해주세요.",
    loginSessionVerifyFailed: "관리자 세션을 확인하지 못했습니다. 새 코드를 요청해주세요.",
    loginNonAdminSessionFailed: "비관리자 세션을 종료하지 못했습니다. 새 코드를 요청해주세요.",
    // Posts Workspace Filters & Table
    postsSearchPlaceholder: "글 검색 (/ 키로 이동)",
    postsSearchAria: "글 검색",
    postsClearSearchAria: "검색어 지우기",
    sortRecentlyUpdated: "최신 수정순",
    sortNewestFirst: "최신 작성순",
    sortOldestFirst: "오래된순",
    sortMostViewed: "조회수순",
    sortMostLiked: "좋아요순",
    filterReset: "초기화",
    tableColCheckbox: "선택",
    tableColTitle: "제목",
    tableColTopic: "주제",
    tableColStatus: "상태",
    tableColDate: "수정일",
    tableColCreatedDate: "작성일",
    tableColViews: "조회수",
    tableColActions: "작업",
    tableSelectAllAria: "전체 글 선택",
    tableEmptyTitle: "등록된 글이 없습니다",
    tableEmptyDesc: "새로운 글을 작성하여 지식을 공유해 보세요.",
    tableEmptyAction: "첫 글 작성하기",
    tableSearchEmptyTitle: "검색 결과가 없습니다",
    tableSearchEmptyDesc: "다른 검색어나 필터 조건을 선택해 보세요.",
    tableSearchEmptyAction: "검색 초기화",
    tableErrorTitle: "글 목록을 불러오지 못했습니다",
    tableErrorAction: "다시 시도",
    tableLoadingAria: "글 목록을 불러오는 중입니다.",
    paginationPageAria: "페이지 이동",
    paginationPrev: "이전",
    paginationNext: "다음",
    // Dashboard Content KPI
    kpiContentStatus: "콘텐츠 현황",
    kpiEngagement: "누적 참여도",
    kpiTotalPosts: "전체",
    kpiViews: "조회",
    kpiLikes: "좋아요",
    kpiPublished: "발행",
    kpiDraft: "초안",
    kpiPrivate: "비공개",
  },
  en: {
    navHub: "Hub",
    navDashboard: "Dashboard",
    navPosts: "Posts",
    navWrite: "New Post",
    navCloud: "Cloud",
    navTools: "Tools",
    navProfile: "Profile",
    filterAll: "All",
    filterDraft: "Draft",
    filterPublished: "Published",
    filterPrivate: "Private",
    filterDeleted: "Deleted",
    actionPublishListed: "Publish Listed",
    actionUnpublishPrivate: "Make Private",
    actionDelete: "Delete",
    actionRestore: "Restore",
    actionHardDelete: "Hard Delete",
    bulkSelectedCount: "selected",
    bulkClearSelection: "Deselect",
    // Shell
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
    // Login
    loginTitle: "Admin Sign In",
    loginSubtitleRequest: "Receive a one-time verification code at your admin email.",
    loginSubtitleVerify: "Enter the 8-digit one-time code sent to your inbox.",
    loginOtpHint: "8-digit numeric verification code",
    loginFieldsAria: "Admin Sign In Fields",
    loginEmail: "Email",
    loginSaveEmail: "Save email",
    loginKeepSignedIn: "Keep me signed in",
    loginCode: "Verification Code",
    loginRemainingTime: "Time left",
    loginReenterEmail: "Re-enter email",
    loginResendCode: "Resend code",
    loginBackToBlog: "Back to Blog",
    loginSubmitRequest: "Get Verification Code",
    loginSubmitVerify: "Sign In",
    loginSubmitExpired: "Code Expired",
    loginVerifying: "Verifying...",
    loginNavigating: "Opening Admin...",
    loginCodeExpired: "Verification code expired. Please request a new code.",
    loginSendingCode: "Sending verification code...",
    loginCodeSent: "Verification code sent.",
    loginCheckingCode: "Checking verification code...",
    loginOpeningAdmin: "Opening admin workspace...",
    loginEmailRequired: "Please enter your email.",
    loginInvalidEmail: "Please check your email format.",
    loginRequestCodeFirst: "Please request a new verification code.",
    loginCodeRequired8Digits: "Please enter the 8-digit verification code.",
    loginAdminRequired: "Admin privileges are required for this page.",
    loginResendCooldown: "Resend Cooldown",
    loginSessionTerminateFailed: "Failed to terminate session. Please request a new code.",
    loginSessionVerifyFailed: "Failed to verify session. Please request a new code.",
    loginNonAdminSessionFailed: "Failed to terminate non-admin session. Please request a new code.",
    // Posts Workspace Filters & Table
    postsSearchPlaceholder: "Search posts (Press / to focus)",
    postsSearchAria: "Search posts",
    postsClearSearchAria: "Clear search keyword",
    sortRecentlyUpdated: "Recently Updated",
    sortNewestFirst: "Newest First",
    sortOldestFirst: "Oldest First",
    sortMostViewed: "Most Viewed",
    sortMostLiked: "Most Liked",
    filterReset: "Reset",
    tableColCheckbox: "Select",
    tableColTitle: "Title",
    tableColTopic: "Topic",
    tableColStatus: "Status",
    tableColDate: "Modified",
    tableColCreatedDate: "Created",
    tableColViews: "Views",
    tableColActions: "Actions",
    tableSelectAllAria: "Select all posts",
    tableEmptyTitle: "No posts yet",
    tableEmptyDesc: "Write a new post to share your knowledge.",
    tableEmptyAction: "Write First Post",
    tableSearchEmptyTitle: "No matching posts found",
    tableSearchEmptyDesc: "Try adjusting your search keyword or filters.",
    tableSearchEmptyAction: "Clear Search",
    tableErrorTitle: "Failed to load posts",
    tableErrorAction: "Retry",
    tableLoadingAria: "Loading posts list...",
    paginationPageAria: "Page navigation",
    paginationPrev: "Previous",
    paginationNext: "Next",
    // Dashboard Content KPI
    kpiContentStatus: "Content Status",
    kpiEngagement: "Engagement",
    kpiTotalPosts: "Total",
    kpiViews: "Views",
    kpiLikes: "Likes",
    kpiPublished: "Pub",
    kpiDraft: "Draft",
    kpiPrivate: "Priv",
  },
}

const ADMIN_TRANSLATIONS: Record<SiteLanguage, Record<AdminI18nKey, string>> = {
  ko: { ...ADMIN_BASE_TRANSLATIONS.ko, ...ADMIN_EDITOR_TRANSLATIONS.ko },
  en: { ...ADMIN_BASE_TRANSLATIONS.en, ...ADMIN_EDITOR_TRANSLATIONS.en },
}

export const adminT = (key: AdminI18nKey, language: SiteLanguage = "ko"): string =>
  ADMIN_TRANSLATIONS[language]?.[key] ?? ADMIN_TRANSLATIONS.ko[key]
