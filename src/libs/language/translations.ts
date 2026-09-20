export type SiteLanguage = "ko" | "en"

const translationTable = {
  navNotes: ["글", "Posts"],
  navTopics: ["태그", "Tags"],
  navAbout: ["소개", "About"],
  navSearch: ["검색", "Search"],
  navSearchShortcut: ["글과 태그 검색", "Search posts & tags"],
  recentPosts: ["최근 글", "Recent Posts"],
  tagTitle: ["태그", "Tags"],
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
  filterFeedPrefix: ["피드 ", "Feed "],
  filterReset: ["초기화", "Reset"],
  emptyFilterTitle: ["검색 결과가 없습니다.", "No posts found."],
  emptyFilterDesc: ["다른 검색어를 입력해보세요.", "Try searching with different keywords."],
  emptyNoPostsTitle: ["아직 게시글이 없습니다.", "No posts yet."],
  emptyNoPostsDesc: ["곧 새로운 글을 준비하겠습니다.", "New posts will be published soon."],
  emptyAboutButton: ["블로그 소개", "About Blog"],
  loadingTitle: ["검색 결과를 불러오는 중...", "Loading search results..."],
  loadingDesc: ["입력한 조건에 맞는 글을 불러오고 있습니다.", "Fetching matching posts."],
  metaDate: ["Date:", "Date:"],
  metaAuthor: ["Author:", "Author:"],
  moreTags: ["더보기", "More"],
  foldTags: ["접기", "Collapse"],
  loadMore: ["더보기", "Load more"],
  loadingMore: ["불러오는 중...", "Loading..."],
  loadMoreErrorTitle: ["다음 글을 불러오지 못했습니다.", "Failed to load more posts."],
  loadMoreErrorDesc: ["일시적인 오류입니다. 잠시 후 다시 시도해주세요.", "A temporary error occurred. Please try again."],
  loadMoreRetry: ["다시 시도", "Retry"],
  loadMorePreparingTitle: ["다음 글을 준비하는 중...", "Preparing next posts..."],
  loadMorePreparingDesc: ["목록을 이어 붙이고 있습니다.", "Appending more articles."],
  initialErrorTitle: ["게시글을 불러오지 못했습니다.", "Failed to load posts."],
  initialErrorFilterTitle: ["검색 결과를 불러오지 못했습니다.", "Failed to load search results."],
  initialErrorDesc: ["일시적인 연결 문제일 수 있습니다. 다시 시도해주세요.", "Temporary network issue. Please try again."],
  initialErrorRetry: ["다시 시도", "Retry"],
  langKo: ["KO", "KO"],
  langEn: ["EN", "EN"],
  langSwitchAria: ["언어 선택 (Language Switcher)", "Language switch"],
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
