export type SiteLanguage = "ko" | "en"

const translationTable = {
  navNotes: ["글", "Posts"],
  navTopics: ["태그", "Tags"],
  navAbout: ["소개", "About"],
  navSearch: ["검색", "Search"],
  navSearchShortcut: ["글과 태그 검색", "Search posts & tags"],
  navSearchTriggerAria: ["글과 태그 검색으로 이동", "Go to post and tag search"],
  navMenu: ["메뉴", "Menu"],
  recentPosts: ["최근 글", "Recent Posts"],
  tagTitle: ["태그", "Tags"],
  filterTagPrefix: ["태그", "Tag"],
  tagAll: ["전체", "All"],
  tagListAria: ["태그 목록", "Tag list"],
  tagSelectAria: ["태그 선택", "Select tag"],
  tagViewAllAria: ["전체보기", "View all"],
  searchPlaceholder: ["제목, 요약, 태그로 검색", "Search by title, summary, or tag..."],
  searchButton: ["검색", "Search"],
  sortTriggerLabel: ["피드 정렬", "Sort feed"],
  sortLatest: ["최신순", "Latest"],
  sortViews: ["조회순", "Views"],
  sortLikes: ["좋아요순", "Likes"],
  pinnedPostsHeader: ["고정된 글", "Pinned Posts"],
  filterResultUnit: ["개", " posts"],
  filterReset: ["초기화", "Reset"],
  emptyFilterTitle: ["검색 결과가 없습니다.", "No posts found."],
  emptyFilterDesc: ["다른 검색어를 입력해보세요.", "Try searching with different keywords."],
  emptyNoPostsTitle: ["아직 게시글이 없습니다.", "No posts yet."],
  emptyNoPostsDesc: ["곧 새로운 글을 준비하겠습니다.", "New posts will be published soon."],
  emptyAboutButton: ["블로그 소개", "About Blog"],
  loadingTitle: ["검색 결과를 불러오는 중...", "Loading search results..."],
  metaDate: ["작성일:", "Date:"],
  metaAuthor: ["글쓴이:", "Author:"],
  moreTags: ["더보기", "More"],
  foldTags: ["접기", "Collapse"],
  loadMore: ["더보기", "Load more"],
  loadingMore: ["불러오는 중...", "Loading..."],
  loadMoreErrorTitle: ["다음 글을 불러오지 못했습니다.", "Failed to load more posts."],
  loadMoreErrorDesc: ["일시적인 오류입니다. 잠시 후 다시 시도해주세요.", "A temporary error occurred. Please try again."],
  loadMoreRetry: ["다시 시도", "Retry"],
  loadMorePreparingTitle: ["다음 글을 준비하는 중...", "Preparing next posts..."],
  initialErrorTitle: ["게시글을 불러오지 못했습니다.", "Failed to load posts."],
  initialErrorFilterTitle: ["검색 결과를 불러오지 못했습니다.", "Failed to load search results."],
  initialErrorDesc: ["일시적인 연결 문제일 수 있습니다. 다시 시도해주세요.", "Temporary network issue. Please try again."],
  initialErrorRetry: ["다시 시도", "Retry"],
  error404Title: ["찾을 수 없는 페이지입니다.", "Page not found."],
  error404Desc: [
    "주소가 바뀌었거나 삭제된 글일 수 있습니다. 홈으로 돌아가 최신 글이나 블로그 소개부터 다시 확인하세요.",
    "The address may have changed or the post may have been removed. Return home or browse the about page.",
  ],
  error404HomeButton: ["홈으로 이동", "Back to Home"],
  langKo: ["KO", "KO"],
  langEn: ["EN", "EN"],
  langSwitchAria: ["언어 선택 (Language Switcher)", "Language switch"],
  langToggleLabel: ["Switch to English", "한국어로 전환"],
  langToggleMobileLabel: ["Switch to English (EN)", "한국어 (KO)로 전환"],
} as const

export type TranslationKey = keyof typeof translationTable

type TranslationsMap = {
  [L in SiteLanguage]: Record<TranslationKey, string>
}

const buildTranslations = (): TranslationsMap => {
  const ko = {} as Record<TranslationKey, string>
  const en = {} as Record<TranslationKey, string>
  for (const [key, [koText, enText]] of Object.entries(translationTable)) {
    const translationKey = key as TranslationKey
    ko[translationKey] = koText
    en[translationKey] = enText
  }
  return { ko, en }
}

export const translations = buildTranslations()
