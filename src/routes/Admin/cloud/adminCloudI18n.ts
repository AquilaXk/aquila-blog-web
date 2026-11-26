import type { CloudMediaKind } from "src/apis/backend/cloud"
import type { SiteLanguage } from "src/libs/language"
import type { CloudMediaFilter, CloudSortMode, UploadQueueStatus } from "../AdminCloudWorkspaceModel"

type CloudDictionary = {
  pageTitle: string
  capacityLimitHint: string
  uploadButton: string
  uploadingButton: string
  dropOverlayTitle: string
  dropOverlayHint: string
  pasteHint: string
  searchPlaceholder: string
  searchLabel: string
  clearSearch: string
  newFolder: string
  rootFolder: string
  folderBreadcrumbAria: string
  emptyFolderUploadHint: string
  viewGrid: string
  viewList: string
  filterAll: string
  filterDocument: string
  filterPhoto: string
  filterVideo: string
  sortLatest: string
  sortOldest: string
  sortName: string
  sortSize: string
  colName: string
  colKind: string
  colSize: string
  colModified: string
  colActions: string
  selectAll: string
  bulkSelectedCount: (count: number) => string
  bulkMove: string
  bulkDownload: string
  bulkDelete: string
  bulkClearSelection: string
  actionPreview: string
  actionRename: string
  actionMove: string
  actionShare: string
  actionDownload: string
  actionDelete: string
  actionMore: string
  statusQueued: string
  statusUploading: string
  statusDone: string
  statusFailed: string
  statusCancelled: string
  queueActiveTitle: (activeCount: number, percent: number) => string
  queueRetryTitle: (count: number) => string
  queueDoneTitle: (count: number) => string
  queueCancelFile: (name: string) => string
  queueRetryFile: (name: string) => string
  queueClearFinished: string
  etaSecondsLabel: (seconds: number) => string
  etaMinutesLabel: (minutes: number, seconds: number) => string
  speedPrefix: string
  noDate: string
  emptyLoading: string
  emptyError: string
  emptyUploading: string
  emptySearching: string
  emptyFiltered: string
  emptyDefault: string
  newFolderTitle: string
  newFolderPlaceholder: string
  newFolderLabel: string
  newFolderConfirm: string
  newFolderInvalid: string
  moveModalTitle: (count: number) => string
  moveTargetLabel: string
  moveCustomPlaceholder: string
  moveConfirm: string
  renameModalTitle: string
  renameInputLabel: string
  renameConfirm: string
  cancel: string
  confirmDeleteSingle: (name: string) => string
  confirmDeleteBulk: (count: number) => string
  confirmDeleteTitle: string
  deleteButton: string
  shareModalTitle: string
  shareTabExternal: string
  shareTabPlayer: string
  shareTabInternal: string
  shareTtlLabel: string
  shareTtl1h: string
  shareTtl6h: string
  shareTtl24h: string
  shareTtl7d: string
  shareIssueExternal: string
  shareIssueInternalNotice: string
  shareExternalNotice: string
  sharePlayerNotice: string
  shareCopyLink: string
  shareCopied: string
  shareCopyInternalPath: string
  shareActiveTokensTitle: string
  shareNoActiveTokens: string
  shareRevokeOne: string
  shareRevokeAll: string
  shareExpiresAt: string
  inspectorIdleTitle: string
  inspectorIdleHint: string
  inspectorMetadataTitle: string
  inspectorFolder: string
  inspectorDimensions: string
  inspectorSize: string
  inspectorModified: string
  inspectorContentType: string
  close: string
  openInspector: string
  prevFile: string
  nextFile: string
  pickerToggleOpen: string
  pickerToggleClose: string
  pickerHeading: string
  pickerSubtitle: string
  pickerPromotableOnly: string
  pickerAllFolders: string
  pickerInsertImage: string
  pickerInserting: string
  pickerInserted: string
  pickerCopyMarkdown: string
  pickerReasonOver8Mb: string
  pickerReasonSvgUnsupported: string
  pickerReasonNotRaster: string
  pickerReasonOver4096: string
  pickerEmpty: string
}

const KO_CLOUD: CloudDictionary = {
  pageTitle: "클라우드",
  capacityLimitHint: "사진 50MB · 문서/압축 95MB · 동영상 5GB 이하",
  uploadButton: "파일 업로드",
  uploadingButton: "업로드 중",
  dropOverlayTitle: "파일을 놓아 클라우드에 업로드",
  dropOverlayHint: "현재 폴더로 바로 업로드됩니다",
  pasteHint: "Ctrl/⌘+V로 클립보드 파일 바로 올리기",
  searchPlaceholder: "파일명 검색",
  searchLabel: "클라우드 파일 검색",
  clearSearch: "검색어 지우기",
  newFolder: "새 폴더",
  rootFolder: "루트",
  folderBreadcrumbAria: "폴더 경로 탐색",
  emptyFolderUploadHint: "이 폴더는 비어 있습니다. 파일을 끌어놓거나 업로드 버튼을 눌러 추가하세요.",
  viewGrid: "그리드 보기",
  viewList: "목록 보기",
  filterAll: "전체",
  filterDocument: "문서",
  filterPhoto: "사진",
  filterVideo: "동영상",
  sortLatest: "최신순",
  sortOldest: "오래된순",
  sortName: "이름순",
  sortSize: "크기순",
  colName: "이름",
  colKind: "종류",
  colSize: "크기",
  colModified: "수정일",
  colActions: "작업",
  selectAll: "현재 페이지 전체 선택",
  bulkSelectedCount: (count) => `${count}개 선택됨`,
  bulkMove: "폴더 이동",
  bulkDownload: "다운로드",
  bulkDelete: "선택 삭제",
  bulkClearSelection: "선택 해제",
  actionPreview: "미리보기",
  actionRename: "이름 변경",
  actionMove: "폴더 이동",
  actionShare: "공유 링크",
  actionDownload: "다운로드",
  actionDelete: "삭제",
  actionMore: "더 보기",
  statusQueued: "대기",
  statusUploading: "업로드 중",
  statusDone: "완료",
  statusFailed: "실패",
  statusCancelled: "취소됨",
  queueActiveTitle: (activeCount, percent) => `파일 ${activeCount}개 업로드 중 · ${percent}%`,
  queueRetryTitle: (count) => `항목 ${count}개 업로드 실패/취소`,
  queueDoneTitle: (count) => `파일 ${count}개 업로드 완료`,
  queueCancelFile: (name) => `${name} 업로드 취소`,
  queueRetryFile: (name) => `${name} 업로드 다시 시도`,
  queueClearFinished: "완료 항목 지우기",
  etaSecondsLabel: (seconds) => `남은 시간 약 ${seconds}초`,
  etaMinutesLabel: (minutes, seconds) => `남은 시간 약 ${minutes}분 ${seconds}초`,
  speedPrefix: "전송 속도",
  noDate: "날짜 없음",
  emptyLoading: "파일을 불러오는 중입니다.",
  emptyError: "파일 목록을 불러오지 못했습니다.",
  emptyUploading: "업로드 중인 파일이 있습니다.",
  emptySearching: "검색 중입니다.",
  emptyFiltered: "선택한 조건에 맞는 파일이 없습니다.",
  emptyDefault: "표시할 파일이 없습니다.",
  newFolderTitle: "새 폴더 만들기",
  newFolderPlaceholder: "예: 2026 세미나/발표 자료",
  newFolderLabel: "폴더 경로",
  newFolderConfirm: "폴더 만들기",
  newFolderInvalid: "폴더 이름에는 '..'이나 제어 문자를 쓸 수 없습니다.",
  moveModalTitle: (count) => (count > 1 ? `선택한 ${count}개 파일 이동` : "폴더 이동"),
  moveTargetLabel: "이동할 폴더",
  moveCustomPlaceholder: "새 폴더 경로 입력 (빈 칸이면 루트)",
  moveConfirm: "이동",
  renameModalTitle: "파일 이름 변경",
  renameInputLabel: "새 파일 이름",
  renameConfirm: "저장",
  cancel: "취소",
  confirmDeleteSingle: (name) => `"${name}" 파일을 영구 삭제합니다. 삭제한 파일은 되돌릴 수 없습니다.`,
  confirmDeleteBulk: (count) => `선택한 파일 ${count}개를 영구 삭제합니다. 삭제한 파일은 되돌릴 수 없습니다.`,
  confirmDeleteTitle: "클라우드 파일 삭제",
  deleteButton: "영구 삭제",
  shareModalTitle: "공유 링크 관리",
  shareTabExternal: "외부 공유 링크",
  shareTabPlayer: "외부 플레이어 (IINA / mpv)",
  shareTabInternal: "관리자 전용 링크",
  shareTtlLabel: "만료 기한",
  shareTtl1h: "1시간",
  shareTtl6h: "6시간",
  shareTtl24h: "24시간",
  shareTtl7d: "7일",
  shareIssueExternal: "공유 링크 발급",
  shareExternalNotice: "만료 기한 전까지 로그인 없이 열 수 있는 공개 링크입니다. 필요할 때 언제든 해제할 수 있습니다.",
  sharePlayerNotice: "IINA 또는 mpv에서 바로 재생할 수 있는 링크와 실행 명령입니다.",
  shareIssueInternalNotice: "관리자로 로그인한 브라우저에서만 열리는 전용 링크입니다. 외부에서는 열 수 없습니다.",
  shareCopyLink: "공유 링크 복사",
  shareCopied: "복사됨",
  shareCopyInternalPath: "관리자 전용 링크 복사",
  shareActiveTokensTitle: "발급된 활성 링크",
  shareNoActiveTokens: "발급된 링크가 없습니다.",
  shareRevokeOne: "해제",
  shareRevokeAll: "모두 해제",
  shareExpiresAt: "만료",
  inspectorIdleTitle: "파일 상세정보",
  inspectorIdleHint: "파일을 선택하면 미리보기, 파일 정보, 공유 링크를 바로 확인할 수 있습니다. (⌘V 붙여넣기 업로드 · F2 이름 변경 · Delete 삭제)",
  inspectorMetadataTitle: "파일 정보",
  inspectorFolder: "폴더",
  inspectorDimensions: "해상도",
  inspectorSize: "크기",
  inspectorModified: "수정일",
  inspectorContentType: "파일 형식",
  close: "닫기",
  openInspector: "상세 보기",
  prevFile: "이전 파일",
  nextFile: "다음 파일",
  pickerToggleOpen: "사진 불러오기",
  pickerToggleClose: "닫기",
  pickerHeading: "클라우드 사진 삽입",
  pickerSubtitle: "8MB · 4,096px 이하 JPEG/PNG/GIF/WebP 이미지만 본문에 삽입할 수 있습니다.",
  pickerPromotableOnly: "삽입 가능한 사진만",
  pickerAllFolders: "전체 폴더",
  pickerInsertImage: "본문에 삽입",
  pickerInserting: "삽입 중...",
  pickerInserted: "삽입됨",
  pickerCopyMarkdown: "마크다운 복사",
  pickerReasonOver8Mb: "8MB 초과 (삽입 불가)",
  pickerReasonSvgUnsupported: "SVG는 본문에 삽입할 수 없습니다",
  pickerReasonNotRaster: "JPEG/PNG/GIF/WebP 이미지만 삽입 가능",
  pickerReasonOver4096: "4,096px 초과 (삽입 불가)",
  pickerEmpty: "조건에 맞는 클라우드 사진이 없습니다.",
}

const EN_CLOUD: CloudDictionary = {
  pageTitle: "Cloud",
  capacityLimitHint: "Photos <= 50MB · Docs/Archives <= 95MB · Video <= 5GB",
  uploadButton: "Upload files",
  uploadingButton: "Uploading",
  dropOverlayTitle: "Drop files to upload to Cloud",
  dropOverlayHint: "Uploads into the current folder",
  pasteHint: "Press Ctrl/⌘+V to paste and upload clipboard files",
  searchPlaceholder: "Search filenames",
  searchLabel: "Search cloud files",
  clearSearch: "Clear search",
  newFolder: "New folder",
  rootFolder: "Root",
  folderBreadcrumbAria: "Folder breadcrumb",
  emptyFolderUploadHint: "This folder is empty. Drop files or click Upload files to add items here.",
  viewGrid: "Grid view",
  viewList: "List view",
  filterAll: "All",
  filterDocument: "Documents",
  filterPhoto: "Photos",
  filterVideo: "Videos",
  sortLatest: "Newest",
  sortOldest: "Oldest",
  sortName: "Name",
  sortSize: "Size",
  colName: "Name",
  colKind: "Kind",
  colSize: "Size",
  colModified: "Modified",
  colActions: "Actions",
  selectAll: "Select all on current page",
  bulkSelectedCount: (count) => `${count} selected`,
  bulkMove: "Move",
  bulkDownload: "Download",
  bulkDelete: "Delete",
  bulkClearSelection: "Clear selection",
  actionPreview: "Preview",
  actionRename: "Rename",
  actionMove: "Move",
  actionShare: "Share link",
  actionDownload: "Download",
  actionDelete: "Delete",
  actionMore: "More actions",
  statusQueued: "Queued",
  statusUploading: "Uploading",
  statusDone: "Done",
  statusFailed: "Failed",
  statusCancelled: "Cancelled",
  queueActiveTitle: (activeCount, percent) => `Uploading ${activeCount} files · ${percent}%`,
  queueRetryTitle: (count) => `${count} upload(s) failed or cancelled`,
  queueDoneTitle: (count) => `${count} upload(s) completed`,
  queueCancelFile: (name) => `Cancel upload ${name}`,
  queueRetryFile: (name) => `Retry upload ${name}`,
  queueClearFinished: "Clear finished",
  etaSecondsLabel: (seconds) => `~${seconds}s left`,
  etaMinutesLabel: (minutes, seconds) => `~${minutes}m ${seconds}s left`,
  speedPrefix: "Speed",
  noDate: "No date",
  emptyLoading: "Loading files...",
  emptyError: "Could not load cloud files.",
  emptyUploading: "Uploads are in progress.",
  emptySearching: "Searching...",
  emptyFiltered: "No files match your filters.",
  emptyDefault: "No files to display.",
  newFolderTitle: "New folder",
  newFolderPlaceholder: "e.g. 2026 Seminars/Slides",
  newFolderLabel: "Folder path",
  newFolderConfirm: "Create folder",
  newFolderInvalid: "Folder path cannot contain '..' or control characters.",
  moveModalTitle: (count) => (count > 1 ? `Move ${count} files` : "Move file"),
  moveTargetLabel: "Destination folder",
  moveCustomPlaceholder: "Enter folder path (leave empty for Root)",
  moveConfirm: "Move",
  renameModalTitle: "Rename file",
  renameInputLabel: "New filename",
  renameConfirm: "Save",
  cancel: "Cancel",
  confirmDeleteSingle: (name) => `Permanently delete "${name}"? This cannot be undone.`,
  confirmDeleteBulk: (count) => `Permanently delete ${count} selected files? This cannot be undone.`,
  confirmDeleteTitle: "Delete cloud files",
  deleteButton: "Delete permanently",
  shareModalTitle: "Share link management",
  shareTabExternal: "External share link",
  shareTabPlayer: "External player (IINA / mpv)",
  shareTabInternal: "Admin-only link",
  shareTtlLabel: "Expiration",
  shareTtl1h: "1 hour",
  shareTtl6h: "6 hours",
  shareTtl24h: "24 hours",
  shareTtl7d: "7 days",
  shareIssueExternal: "Create share link",
  shareExternalNotice: "Anyone with this link can view the file without logging in until it expires. You can disable it anytime.",
  sharePlayerNotice: "Streaming link and player commands for IINA or mpv.",
  shareIssueInternalNotice: "Accessible only when logged in as an admin. External visitors cannot open this link.",
  shareCopyLink: "Copy share link",
  shareCopied: "Copied",
  shareCopyInternalPath: "Copy admin link",
  shareActiveTokensTitle: "Active links",
  shareNoActiveTokens: "No active links.",
  shareRevokeOne: "Disable",
  shareRevokeAll: "Disable all",
  shareExpiresAt: "Expires",
  inspectorIdleTitle: "File details",
  inspectorIdleHint: "Select a file to preview it and view details or share links. (Ctrl/⌘+V paste upload · F2 rename · Delete remove)",
  inspectorMetadataTitle: "Details",
  inspectorFolder: "Folder",
  inspectorDimensions: "Dimensions",
  inspectorSize: "Size",
  inspectorModified: "Modified",
  inspectorContentType: "File type",
  close: "Close",
  openInspector: "Inspect",
  prevFile: "Previous file",
  nextFile: "Next file",
  pickerToggleOpen: "Choose photo",
  pickerToggleClose: "Close",
  pickerHeading: "Insert Cloud Photo",
  pickerSubtitle: "Only JPEG, PNG, GIF, or WebP images up to 8MB and 4,096px can be inserted into posts.",
  pickerPromotableOnly: "Insertable only",
  pickerAllFolders: "All folders",
  pickerInsertImage: "Insert image",
  pickerInserting: "Inserting...",
  pickerInserted: "Inserted",
  pickerCopyMarkdown: "Copy markdown",
  pickerReasonOver8Mb: "Exceeds 8MB limit",
  pickerReasonSvgUnsupported: "SVG cannot be inserted into posts",
  pickerReasonNotRaster: "Only JPEG, PNG, GIF, or WebP images are supported",
  pickerReasonOver4096: "Exceeds 4,096px limit",
  pickerEmpty: "No matching Cloud photos found.",
}

export const getCloudDictionary = (language: SiteLanguage): CloudDictionary =>
  language === "en" ? EN_CLOUD : KO_CLOUD

export const getCloudKindLabelI18n = (
  kind: CloudMediaFilter | CloudMediaKind,
  language: SiteLanguage
): string => {
  const dict = getCloudDictionary(language)
  if (kind === "DOCUMENT") return dict.filterDocument
  if (kind === "PHOTO") return dict.filterPhoto
  if (kind === "VIDEO") return dict.filterVideo
  return dict.filterAll
}

export const getCloudSortLabelI18n = (sort: CloudSortMode, language: SiteLanguage): string => {
  const dict = getCloudDictionary(language)
  if (sort === "OLDEST") return dict.sortOldest
  if (sort === "NAME") return dict.sortName
  if (sort === "SIZE") return dict.sortSize
  return dict.sortLatest
}

export const getCloudQueueStatusLabelI18n = (
  status: UploadQueueStatus,
  language: SiteLanguage
): string => {
  const dict = getCloudDictionary(language)
  if (status === "queued") return dict.statusQueued
  if (status === "uploading") return dict.statusUploading
  if (status === "done") return dict.statusDone
  if (status === "failed") return dict.statusFailed
  return dict.statusCancelled
}
