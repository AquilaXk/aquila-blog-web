// 참조 구현: TryGhost/Ghost (MIT) & payloadcms/payload (MIT) — 에디터 전용 한/영 사전 모듈
import type { SiteLanguage } from "src/libs/language"
import { ADMIN_EDITOR_EN_TRANSLATIONS } from "./adminEditorI18nEn"

export type AdminEditorI18nKey =
  | "editorPageHeading"
  | "editorBackToPosts"
  | "editorOutlineToggle"
  | "editorOutlineTitle"
  | "editorOutlineOpen"
  | "editorOutlineClose"
  | "editorOutlineHeadingsSuffix"
  | "editorOutlineHeadingUnit"
  | "editorOutlineReadingPrefix"
  | "editorOutlineReadingSuffix"
  | "editorOutlineEmpty"
  | "editorSaveStatusAria"
  | "editorSelectedCharsPrefix"
  | "editorCharUnit"
  | "editorWordUnit"
  | "editorMinutePrefix"
  | "editorMinuteUnit"
  | "editorLinkLabel"
  | "editorLinkWarnLabel"
  | "editorZenToggle"
  | "editorZenTitle"
  | "editorZenLabel"
  | "editorZenActiveLabel"
  | "editorSettingsToggle"
  | "editorSettingsLabel"
  | "editorGuideButton"
  | "editorTitlePlaceholder"
  | "editorSubtitleLabel"
  | "editorSummaryLabel"
  | "editorSummaryPlaceholder"
  | "editorBodyPlaceholder"
  | "editorActiveLinePlaceholder"
  | "editorReadingPreviewLoading"
  | "editorPropsToggleAria"
  | "editorPropsLabel"
  | "editorPropsCollapse"
  | "editorPropsExpand"
  | "editorTagsUnitSuffix"
  | "editorTagInputAria"
  | "editorTagPlaceholder"
  | "editorTagDeleteSuffix"
  | "editorCategoryBadgePrefix"
  | "editorPublishSettingsAria"
  | "editorSettingsHeading"
  | "editorSettingsCloseAria"
  | "editorVisibilityLabel"
  | "editorTagsHeading"
  | "editorPublishTagsAria"
  | "editorTagAddPlaceholder"
  | "editorTagAddAria"
  | "editorCategoryOptional"
  | "editorCategoryPlaceholder"
  | "editorCategoryClearAria"
  | "editorCategoryClear"
  | "editorCategoryHint"
  | "editorLinkWarningPrefix"
  | "editorLinkWarningSuffix"
  | "editorReloadLatest"
  | "editorLoadingHeading"
  | "editorLoadingSub"
  | "editorDraftBannerTitle"
  | "editorDraftSelectAria"
  | "editorDraftSelectPlaceholder"
  | "editorDraftRestore"
  | "editorDraftDelete"
  | "editorDraftDismiss"
  | "editorActionPublishSettings"
  | "editorActionModifySettings"
  | "editorActionNewPost"
  | "editorActionPublishing"
  | "editorActionPublish"
  | "editorActionUpdating"
  | "editorActionUpdate"
  | "editorActionCreating"
  | "editorActionOpenPublish"
  | "editorActionOpenModify"
  | "editorStatusSaving"
  | "editorStatusSaved"
  | "editorStatusAutoSaved"
  | "editorStatusLocalAutoSaved"
  | "editorStatusUnsaved"
  | "editorVisibilityPublicLabel"
  | "editorVisibilityPublicDesc"
  | "editorVisibilityUnlistedLabel"
  | "editorVisibilityUnlistedDesc"
  | "editorVisibilityPrivateLabel"
  | "editorVisibilityPrivateDesc"
  | "editorReadinessTitle"
  | "editorReadinessItemsUnit"
  | "editorReadinessTitleRow"
  | "editorReadinessEntered"
  | "editorReadinessRequired"
  | "editorReadinessBodyRow"
  | "editorReadinessBodyWordSuffix"
  | "editorReadinessWriteNeeded"
  | "editorReadinessSummaryRow"
  | "editorReadinessManual"
  | "editorReadinessAuto"
  | "editorReadinessTagRow"
  | "editorReadinessCountUnit"
  | "editorReadinessLinkRow"
  | "editorReadinessLinkWarn"
  | "editorReadinessLinkOk"
  | "editorFeatureUploadingCover"
  | "editorFeatureAddCover"
  | "editorFeaturePreviewAlt"
  | "editorFeatureNoImage"
  | "editorFeatureBadge"
  | "editorFeatureUploadingShort"
  | "editorFeatureChangeImage"
  | "editorFeatureResetAuto"
  | "editorGuideTitle"
  | "editorGuideClose"
  | "editorGuideIntro"
  | "editorGuideColElement"
  | "editorGuideColExample"
  | "editorGuideColShortcut"
  | "editorGuideRepoLabel"
  | "editorRevisionCompare"
  | "editorRevisionCloseCompare"
  | "editorRevisionLoadingDiff"
  | "editorRevisionLoadError"
  | "editorRevisionNoChanges"
  | "editorRevisionTruncated"
  | "editorRevisionTitleChanged"
  | "editorRevisionTagsChanged"
  | "editorRevisionLinesAdded"
  | "editorRevisionLinesRemoved"
  | "editorRevisionSnapshotTitle"
  | "editorRevisionCurrentTitle"
  | "editorCloseLabel"
  | "editorVisibilityPublicFull"
  | "editorVisibilityUnlistedFull"
  | "editorVisibilityPrivateFull"
  | "editorUploadInvalidResponse"
  | "editorUploadImageMetaError"
  | "editorUploadInvalidImageUrl"
  | "editorUploadInvalidThumbUrl"
  | "editorUploadImageDone"
  | "editorUploadFileDone"
  | "editorUploadThumbDone"
  | "editorValidationTitleRequired"
  | "editorValidationBodyRequired"
  | "editorValidationAlreadyEditMode"
  | "editorValidationSelectPost"
  | "editorValidationVersionMissing"
  | "editorValidationNewPostMissing"
  | "editorValidationNewPostVersionMissing"
  | "editorValidationInvalidSummary"
  | "editorSaveWriting"
  | "editorSaveModifying"
  | "editorSaveTempPublishing"
  | "editorSaveTempDone"
  | "editorVisibilityShortPublic"
  | "editorVisibilityShortUnlisted"
  | "editorVisibilityShortPrivate"
  | "editorVisibilityShortDraft"
  | "editorCoverEyebrow"
  | "editorSectionVisibilityEyebrow"
  | "editorSectionTaxonomyEyebrow"
  | "editorSectionExcerptEyebrow"
  | "editorSectionCloudEyebrow"
  | "editorSectionRevisionsEyebrow"
  | "editorPublishCancelAria"
  | "editorStatusLineCol"
  | "editorVisibilitySectionKicker"
  | "editorVisibilityQuestion"
  | "editorVisibilityGroupAria"
  | "editorVisibilityFeedHelp"
  | "editorCoverOptionalHeading"
  | "editorCoverAutoSetupDesc"
  | "editorCoverManualBadge"
  | "editorCoverAutoBadge"
  | "editorThumbFocusHeading"
  | "editorThumbFocusDesc"
  | "editorCardMetaHeading"
  | "editorCardMetaDesc"
  | "editorPanelOpenLabel"
  | "editorSectionPublishingEyebrow"
  | "editorScheduleLabel"
  | "editorScheduleNow"
  | "editorScheduleLater"
  | "editorScheduleInputLabel"
  | "editorScheduleClear"
  | "editorSchedulePrivateHint"
  | "editorSchedulePastError"
  | "editorScheduleBadgePrefix"
  | "editorActionSchedule"
  | "editorActionUpdateSchedule"
  | "editorSeriesNameLabel"
  | "editorSeriesNamePlaceholder"
  | "editorSeriesOrderLabel"
  | "editorSeriesOrderPlaceholder"
  | "editorCanonicalUrlLabel"
  | "editorCanonicalUrlPlaceholder"
  | "editorCanonicalUrlInvalid"
  | "editorTempDraftsButton"
  | "editorTempDraftsTitle"
  | "editorTempDraftsCreateNew"
  | "editorTempDraftsEmpty"
  | "editorTempDraftsCurrent"
  | "editorTempDraftsOpen"
  | "editorTempDraftsDelete"
  | "editorTempDraftsDeleteConfirm"
  | "editorTempDraftsLoading"
  | "editorTempDraftsCloseAria"
  | "editorValidationContentTooLong"
  | "editorValidationInvalidSeriesOrder"
  | "editorValidationScheduledRequiresPublic"
  | "editorValidationScheduledPast"

export const ADMIN_EDITOR_TRANSLATIONS: Record<SiteLanguage, Record<AdminEditorI18nKey, string>> = {
  ko: {
    editorPageHeading: "글 편집",
    editorBackToPosts: "글 관리",
    editorOutlineToggle: "문서 목차 토글",
    editorOutlineTitle: "문서 목차",
    editorOutlineOpen: "문서 목차 열기",
    editorOutlineClose: "목차 닫기",
    editorOutlineHeadingsSuffix: "개",
    editorOutlineHeadingUnit: "헤딩",
    editorOutlineReadingPrefix: "약",
    editorOutlineReadingSuffix: "분 읽기",
    editorOutlineEmpty: "제목과 본문 heading을 입력하면 목차가 표시됩니다.",
    editorSaveStatusAria: "편집기 저장 상태",
    editorSelectedCharsPrefix: "선택",
    editorCharUnit: "자",
    editorWordUnit: "단어",
    editorMinutePrefix: "약",
    editorMinuteUnit: "분",
    editorLinkLabel: "링크",
    editorLinkWarnLabel: "주의",
    editorZenToggle: "집중 모드 토글",
    editorZenTitle: "집중 모드 (사이드바 숨김 · Cmd/Ctrl+Shift+F)",
    editorZenLabel: "집중 모드",
    editorZenActiveLabel: "집중 모드 켜짐",
    editorSettingsToggle: "메타 패널 토글",
    editorSettingsLabel: "설정",
    editorGuideButton: "Markdown 가이드",
    editorTitlePlaceholder: "제목을 입력하세요",
    editorSubtitleLabel: "부제목",
    editorSummaryLabel: "요약",
    editorSummaryPlaceholder: "요약 또는 부제목을 입력하세요 (선택)",
    editorBodyPlaceholder: "글 내용을 입력하거나 '/'를 눌러 서식을 빠르게 추가하세요...",
    editorActiveLinePlaceholder: "'/'를 눌러 블록을 삽입하거나 내용을 입력하세요...",
    editorReadingPreviewLoading: "미리보기를 불러오는 중입니다...",
    editorPropsToggleAria: "속성 정보 토글",
    editorPropsLabel: "속성",
    editorPropsCollapse: "접기 ▲",
    editorPropsExpand: "펼치기",
    editorTagsUnitSuffix: "개 태그",
    editorTagInputAria: "태그 입력",
    editorTagPlaceholder: "태그 입력 후 Enter",
    editorTagDeleteSuffix: "삭제",
    editorCategoryBadgePrefix: "분류",
    editorPublishSettingsAria: "발행 설정",
    editorSettingsHeading: "글 설정",
    editorSettingsCloseAria: "설정 패널 닫기",
    editorVisibilityLabel: "공개 범위",
    editorTagsHeading: "태그",
    editorPublishTagsAria: "발행 태그",
    editorTagAddPlaceholder: "태그 추가",
    editorTagAddAria: "태그 추가",
    editorCategoryOptional: "분류 (선택)",
    editorCategoryPlaceholder: "분류 입력 또는 선택",
    editorCategoryClearAria: "카테고리 지우기",
    editorCategoryClear: "지우기",
    editorCategoryHint: "하나의 글에는 넓은 분류를 하나만 선택하세요. 세부 키워드는 태그로 추가할 수 있습니다.",
    editorLinkWarningPrefix: "링크 주소가 비어 있거나 http:// 또는 https://만 입력된 링크가",
    editorLinkWarningSuffix: "개 있습니다. 주소를 완성해 주세요.",
    editorReloadLatest: "서버 최신본 다시 불러오기",
    editorLoadingHeading: "편집 화면을 준비하고 있습니다.",
    editorLoadingSub: "잠시만 기다려 주세요.",
    editorDraftBannerTitle: "브라우저 임시글이 있습니다.",
    editorDraftSelectAria: "복구할 브라우저 초안",
    editorDraftSelectPlaceholder: "초안을 선택하세요",
    editorDraftRestore: "복구",
    editorDraftDelete: "삭제",
    editorDraftDismiss: "이번 세션에 표시 안 함",
    editorActionPublishSettings: "발행 설정",
    editorActionModifySettings: "수정 설정",
    editorActionNewPost: "새 글 작성",
    editorActionPublishing: "발행 중...",
    editorActionPublish: "발행하기",
    editorActionUpdating: "반영 중...",
    editorActionUpdate: "변경 반영",
    editorActionCreating: "작성 중...",
    editorActionOpenPublish: "발행 설정 열기",
    editorActionOpenModify: "수정 설정 열기",
    editorStatusSaving: "저장 중",
    editorStatusSaved: "저장됨",
    editorStatusAutoSaved: "자동 저장됨",
    editorStatusLocalAutoSaved: "로컬 임시 저장됨",
    editorStatusUnsaved: "저장되지 않은 변경",
    editorVisibilityPublicLabel: "전체 공개",
    editorVisibilityPublicDesc: "메인 목록과 검색에 노출됩니다.",
    editorVisibilityUnlistedLabel: "링크 공개",
    editorVisibilityUnlistedDesc: "URL을 아는 사람만 볼 수 있습니다.",
    editorVisibilityPrivateLabel: "비공개",
    editorVisibilityPrivateDesc: "관리자만 확인합니다.",
    editorReadinessTitle: "발행 준비 상태",
    editorReadinessItemsUnit: "항목",
    editorReadinessTitleRow: "제목 완료",
    editorReadinessEntered: "입력됨",
    editorReadinessRequired: "필요",
    editorReadinessBodyRow: "본문 분량",
    editorReadinessBodyWordSuffix: "단어",
    editorReadinessWriteNeeded: "작성 필요",
    editorReadinessSummaryRow: "요약 준비",
    editorReadinessManual: "수동 입력",
    editorReadinessAuto: "자동 발췌",
    editorReadinessTagRow: "태그 구성",
    editorReadinessCountUnit: "개",
    editorReadinessLinkRow: "링크 점검",
    editorReadinessLinkWarn: "주의",
    editorReadinessLinkOk: "정상",
    editorFeatureUploadingCover: "커버 이미지 업로드 중...",
    editorFeatureAddCover: "+ 커버 이미지 추가",
    editorFeaturePreviewAlt: "글 대표 이미지 미리보기",
    editorFeatureNoImage: "이미지 없음",
    editorFeatureBadge: "대표 이미지 지정됨",
    editorFeatureUploadingShort: "업로드 중...",
    editorFeatureChangeImage: "이미지 변경",
    editorFeatureResetAuto: "자동 모드로 초기화",
    editorGuideTitle: "Markdown 작성 가이드",
    editorGuideClose: "가이드 닫기",
    editorGuideIntro: "글 제목은 별도 필드가 H1 역할을 하며, 본문은 동일한 Markdown 구문 스펙으로 라이브 편집기와 공개 글을 렌더링합니다.",
    editorGuideColElement: "요소",
    editorGuideColExample: "구문 예시",
    editorGuideColShortcut: "단축키",
    editorGuideRepoLabel: "프로젝트 리포지터리",
    editorRevisionCompare: "현재 글과 비교",
    editorRevisionCloseCompare: "비교 닫기",
    editorRevisionLoadingDiff: "리비전 본문과 변경점을 불러오는 중...",
    editorRevisionLoadError: "리비전 스냅샷 본문을 불러오지 못했습니다.",
    editorRevisionNoChanges: "현재 편집 중인 원고와 차이가 없습니다.",
    editorRevisionTruncated: "문서 길이 또는 줄 수 상한을 초과해 상세 줄 비교 대신 요약만 표시합니다.",
    editorRevisionTitleChanged: "제목 변경",
    editorRevisionTagsChanged: "태그 변경",
    editorRevisionLinesAdded: "추가 줄",
    editorRevisionLinesRemoved: "삭제 줄",
    editorRevisionSnapshotTitle: "리비전",
    editorRevisionCurrentTitle: "현재",
    editorCloseLabel: "닫기",
    editorVisibilityPublicFull: "전체 공개(목록 노출)",
    editorVisibilityUnlistedFull: "링크 공개(목록 미노출)",
    editorVisibilityPrivateFull: "비공개",
    editorUploadInvalidResponse: "업로드 응답 형식이 올바르지 않습니다.",
    editorUploadImageMetaError: "이미지 markdown 메타데이터를 해석하지 못했습니다.",
    editorUploadInvalidImageUrl: "허용되지 않은 이미지 URL 형식입니다.",
    editorUploadInvalidThumbUrl: "허용되지 않은 썸네일 URL 형식입니다.",
    editorUploadImageDone: "이미지 업로드가 완료되었습니다.",
    editorUploadFileDone: "첨부 파일 업로드가 완료되었습니다.",
    editorUploadThumbDone: "썸네일 파일 업로드가 완료되었습니다.",
    editorValidationTitleRequired: "제목을 입력해주세요.",
    editorValidationBodyRequired: "본문을 입력해주세요.",
    editorValidationAlreadyEditMode: "현재는 수정 모드입니다. 새 글을 만들려면 먼저 '새 글 모드 전환'을 눌러주세요.",
    editorValidationSelectPost: "수정할 글 ID를 먼저 선택해주세요.",
    editorValidationVersionMissing: "최신 글 버전을 불러오지 못했습니다. 글을 다시 열어주세요.",
    editorValidationNewPostMissing: "작성할 새 글을 먼저 불러와주세요.",
    editorValidationNewPostVersionMissing: "새 글 버전을 불러오지 못했습니다. 글을 다시 열어주세요.",
    editorValidationInvalidSummary: "저장된 canonical summary 응답이 올바르지 않습니다.",
    editorSaveWriting: "글 작성 중입니다...",
    editorSaveModifying: "글 수정 중입니다...",
    editorSaveTempPublishing: "새 글을 작성하는 중입니다...",
    editorSaveTempDone: "새 글 작성이 완료되었습니다.",
    editorVisibilityShortPublic: "PUBLIC",
    editorVisibilityShortUnlisted: "UNLISTED",
    editorVisibilityShortPrivate: "PRIVATE",
    editorVisibilityShortDraft: "DRAFT",
    editorCoverEyebrow: "COVER",
    editorSectionVisibilityEyebrow: "01 VISIBILITY",
    editorSectionTaxonomyEyebrow: "02 TAXONOMY",
    editorSectionExcerptEyebrow: "03 EXCERPT",
    editorSectionCloudEyebrow: "04 CLOUD ASSETS",
    editorSectionRevisionsEyebrow: "05 REVISIONS",
    editorPublishCancelAria: "발행 설정 취소",
    editorStatusLineCol: "줄 {line}, 열 {col}",
    editorVisibilitySectionKicker: "노출 범위",
    editorVisibilityQuestion: "누가 이 글을 볼 수 있나요?",
    editorVisibilityGroupAria: "노출 범위 선택",
    editorVisibilityFeedHelp: "메인 피드 노출은 전체 공개에서만 활성화됩니다.",
    editorCoverOptionalHeading: "공유 대표 이미지 직접 지정 (선택)",
    editorCoverAutoSetupDesc: "비워두면 본문 첫 이미지 또는 제목 기반 OG 카드가 공유 미리보기에 자동 적용됩니다.",
    editorCoverManualBadge: "수동 지정됨",
    editorCoverAutoBadge: "자동 적용",
    editorThumbFocusHeading: "썸네일 위치 조정",
    editorThumbFocusDesc: "드래그/확대로 공유 대표 이미지 초점을 맞춥니다.",
    editorCardMetaHeading: "카드 메타 편집",
    editorCardMetaDesc: "썸네일 URL과 업로드 방식을 설정합니다.",
    editorPanelOpenLabel: "열기",
    editorSectionPublishingEyebrow: "06 PUBLISHING",
    editorScheduleLabel: "발행 일정",
    editorScheduleNow: "즉시 발행",
    editorScheduleLater: "예약 발행",
    editorScheduleInputLabel: "예약 일시",
    editorScheduleClear: "예약 해제",
    editorSchedulePrivateHint: "비공개 글은 예약 발행을 설정할 수 없습니다. 전체 공개 또는 링크 공개를 선택해주세요.",
    editorSchedulePastError: "예약 발행 시각은 현재 시각 이후여야 합니다.",
    editorScheduleBadgePrefix: "예약",
    editorActionSchedule: "예약 발행",
    editorActionUpdateSchedule: "예약 수정",
    editorSeriesNameLabel: "연재 시리즈 (선택)",
    editorSeriesNamePlaceholder: "예: Compiler Design",
    editorSeriesOrderLabel: "회차 순번",
    editorSeriesOrderPlaceholder: "1",
    editorCanonicalUrlLabel: "정본 URL (교차 게시 선택)",
    editorCanonicalUrlPlaceholder: "https://origin.example.com/posts/...",
    editorCanonicalUrlInvalid: "http:// 또는 https://로 시작하는 유효한 URL만 사용할 수 있습니다.",
    editorTempDraftsButton: "임시글",
    editorTempDraftsTitle: "서버 임시초안 목록",
    editorTempDraftsCreateNew: "새 임시초안",
    editorTempDraftsEmpty: "저장된 서버 임시초안이 없습니다.",
    editorTempDraftsCurrent: "현재 편집 중",
    editorTempDraftsOpen: "불러오기",
    editorTempDraftsDelete: "삭제",
    editorTempDraftsDeleteConfirm: "이 임시초안을 삭제할까요? 삭제한 초안은 복구할 수 없습니다.",
    editorTempDraftsLoading: "임시초안 목록을 불러오는 중입니다...",
    editorTempDraftsCloseAria: "임시초안 목록 닫기",
    editorValidationContentTooLong: "본문 길이가 최대 500,000자를 초과했습니다. 내용을 분할해 주세요.",
    editorValidationInvalidSeriesOrder: "시리즈 회차 순번은 1 이상의 정수여야 합니다.",
    editorValidationScheduledRequiresPublic: "비공개 글에는 예약 발행을 설정할 수 없습니다.",
    editorValidationScheduledPast: "예약 발행 시각은 현재 시각 이후여야 합니다.",
  },
  en: ADMIN_EDITOR_EN_TRANSLATIONS,
}
