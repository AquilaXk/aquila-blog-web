# Third-Party Notices

This repository includes patterns and algorithms adapted from or inspired by the following open-source projects, used in compliance with their respective MIT, Apache-2.0, and SIL Open Font License 1.1 terms.

---

## Ghost

- Repository: https://github.com/TryGhost/Ghost
- Reference path: `apps/admin/src/layout/` (`admin-layout.tsx`, `app-sidebar/app-sidebar.tsx` — crisp outer workspace frame, inset `StudioCardFrame`, collapsible sidebar rail, single compact breadcrumb header), `apps/shade/src/components/` (`ui/kpi-card.tsx`, `ui/data-list.tsx`, `layout/list-page.tsx` — bordered hairline-divided KPI stat strip, proportional bar list, list surface), `apps/admin/src/auth/` (`auth-layout.tsx`, `signin.tsx`, `signin-verify.tsx` — 2-step passwordless OTP verification), `apps/admin/src/global-search/global-search-modal.tsx` (inline query highlight segments & command modal structure), `apps/admin/src/analytics/views/stats/overview/overview.tsx` (overview summary & content analytics layout), `apps/admin/src/posts/list/` (`posts-list-screen.tsx`, `components/post-list-row.tsx` — `16:10` row thumbnail slot, underline status tabs, restrained status pills, scannable meta hierarchy), `apps/admin/src/settings/layout/` (`settings-main-content.tsx`, `sidebar.tsx`, `dirty-navigation-guard.tsx` — 2-column settings section rail & sticky unsaved-changes save/discard dock), `apps/admin/src/editor/` (`editor-screen.tsx`, `post-editor.tsx`, `writing-focus.ts`, `settings-open.ts`, `post-settings-sidebar.tsx`, `feature-image.tsx`, `editor-status.tsx`), `ghost/admin/app/components/editor/modals/publish-flow/`, `ghost/core/server/services/oembed/extract-metadata.ts`, SERP snippet preview (`ghost/admin/app/components/gh-snippet-preview.hbs`), Koenig IME composition guards, and keyboard save/publish shortcuts
- Applied in: `src/routes/Admin/adminColorTokens.ts`, `src/routes/Admin/AdminShell.tsx`, `src/routes/Admin/AdminShellSidebar.styles.ts`, `src/routes/Admin/AdminShellTopBar.styles.ts`, `src/pages/admin/login.tsx`, `src/routes/Admin/AdminLogin.styles.ts`, `src/routes/Admin/AdminCommandPalette.tsx`, `src/pages/admin.tsx`, `src/routes/Admin/AdminHubSurface.tsx`, `src/routes/Admin/AdminHubSurface.sections.tsx`, `src/routes/Admin/AdminHubSurface.styles.ts`, `src/routes/Admin/AdminHubSurface.styles.chrome.ts`, `src/routes/Admin/AdminDashboardWorkspaceModel.ts`, `src/routes/Admin/AdminDashboardWorkspacePage.tsx`, `src/routes/Admin/AdminDashboardWorkspaceView.tsx`, `src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts`, `src/routes/Admin/AdminPostsWorkspaceModel.ts`, `src/routes/Admin/AdminPostsWorkspaceList.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.styles.ts`, `src/routes/Admin/AdminPostsWorkspaceFilterToolbar.tsx`, `src/routes/Admin/AdminProfileWorkspaceSections.tsx`, `src/routes/Admin/AdminProfileWorkspace.styles.layout.ts`, `src/routes/Admin/AdminProfileWorkspace.styles.sections.ts`, `src/routes/Admin/editorStudioWritingFocus.ts`, `src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx`, `src/routes/Admin/EditorStudioDedicatedSurfaceComponents.tsx`, `src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx`, `src/routes/Admin/EditorStudioDedicatedPanelParts.tsx`, `src/routes/Admin/EditorStudioEditorialStyles.ts`, `src/routes/Admin/EditorStudioFeatureImageBar.tsx`, `src/routes/Admin/EditorStudioGuideModal.tsx`, `src/routes/Admin/EditorStudioCloudAssetPicker.tsx`, `src/routes/Admin/EditorStudioPublishReadinessCard.tsx`, `src/routes/Admin/EditorStudioRevisionHistoryCard.tsx`, `src/routes/Admin/EditorStudioThumbnailPanels.tsx`, `src/routes/Admin/editorStudioDedicatedSurfaceModel.ts`, `src/libs/unfurl/extractMeta.ts`, `src/routes/Admin/adminI18n.ts`, `src/routes/Admin/adminEditorI18n.ts`, `src/components/markdown-editor/markdownEditorI18n.ts`, `src/routes/Admin/useEditorStudioKeyboardShortcuts.ts`, `src/routes/Admin/EditorStudioPublishModal.tsx`, `src/routes/Admin/EditorStudioPublishModalParts.tsx`, `src/routes/Admin/EditorStudioPublishModalSerpStyles.ts`, `src/routes/Admin/EditorStudioPublishModalShellStyles.tsx`, `src/routes/Admin/EditorStudioPublishModalStyles.tsx`
- License: MIT License (Copyright (c) Ghost Foundation)

## shadcn/ui

- Repository: https://github.com/shadcn-ui/ui
- Reference path: `apps/v4/registry/new-york-v4/blocks/dashboard-01/` (`page.tsx`, `components/app-sidebar.tsx`, `components/nav-main.tsx`, `components/nav-user.tsx`, `components/site-header.tsx`, `components/section-cards.tsx`, `components/chart-area-interactive.tsx`, `components/data-table.tsx` — monochrome `zinc` studio token palette, `Quick Create` sidebar header CTA, 4/5-column subtle-gradient KPI `SectionCards` with trend badges, SVG area/bar analytics panel, unified bordered `DataTable` with underline view tabs & footer count), `apps/v4/registry/new-york-v4/blocks/login-03/` (`page.tsx`, `components/login-form.tsx` — muted dot-grid auth canvas, centered brand banner above card, `FieldSeparator` divider), and `apps/v4/registry/new-york-v4/ui/` (`card.tsx`, `table.tsx`, `command.tsx`, `sidebar.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `empty.tsx`)
- Applied in: `src/components/ProfileImage.tsx`, `src/components/quick-search/QuickSearchPalette.tsx`, `src/components/quick-search/QuickSearchPalette.styles.ts`, `src/layouts/RootLayout/Header/NavBarMobileMenu.styles.ts`, `src/design-system/ConfirmDialog.tsx`, `src/design-system/Toast.tsx`, `src/design-system/StatePresenters.tsx`, `src/routes/Error/index.tsx`, `src/routes/Feed/FeedExplorer.tsx`, `src/routes/Feed/FeedExplorer.styles.ts`, `src/routes/Feed/PostList/index.tsx`, `src/routes/Feed/PostList/InitialLoadErrorState.tsx`, `src/routes/About/AboutPageView.tsx`, `src/routes/About/AboutPage.styles.ts`, `src/routes/Company/CompanyPageView.tsx`, `src/routes/Company/CompanyDownloadPageView.tsx`, `src/routes/Company/CompanyDownload.styles.ts`, `src/routes/Company/CompanyBentoVisuals.tsx`, `src/routes/Company/CompanyFeatureCarousel.tsx`, `src/routes/Company/CompanyNews.styles.ts`, `src/routes/EasySubway/EasySubwayPageView.tsx`, `src/routes/EasySubway/EasySubwayPage.styles.ts`, `src/routes/EasySubway/EasySubwayFeatures.styles.ts`, `src/routes/EasySubway/EasySubwayScope.styles.ts`, `src/routes/EasySubway/EasySubwayRouteSpecTable.tsx`, `src/routes/EasySubway/EasySubwayTechSpecGrid.tsx`, `src/routes/Admin/adminColorTokens.ts`, `src/routes/Admin/AdminShell.tsx`, `src/routes/Admin/AdminShellSidebar.styles.ts`, `src/routes/Admin/AdminShellTopBar.styles.ts`, `src/pages/admin/login.tsx`, `src/routes/Admin/AdminLoginModel.ts`, `src/routes/Admin/AdminLogin.styles.ts`, `src/routes/Admin/AdminCommandPalette.tsx`, `src/routes/Admin/AdminCommandPalette.styles.ts`, `src/routes/Admin/AdminHubSurface.tsx`, `src/routes/Admin/AdminHubSurfaceModel.ts`, `src/routes/Admin/AdminHubSurface.sections.tsx`, `src/routes/Admin/AdminHubSurface.styles.ts`, `src/routes/Admin/AdminHubSurface.styles.chrome.ts`, `src/routes/Admin/AdminDashboardWorkspaceView.tsx`, `src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts`, `src/routes/Admin/AdminPostsWorkspacePageView.tsx`, `src/routes/Admin/AdminPostsWorkspaceFilterToolbar.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.styles.ts`, `src/routes/Admin/AdminPostsWorkspaceBulkAndPage.styles.ts`, `src/routes/Admin/AdminToolsOpsOverview.tsx`, `src/routes/Admin/AdminToolsWorkspacePage.tsx`, `src/routes/Admin/AdminToolsWorkspace.styles.ts`, `src/routes/Admin/EditorStudioGuideModal.tsx`
- License: MIT License (Copyright (c) 2023 shadcn)

## Medusa v2

- Repository: https://github.com/medusajs/medusa
- Reference path: `packages/admin/dashboard/src/components/layout/{shell/shell.tsx,nav-item/nav-item.tsx,settings-layout/settings-layout.tsx}` (bezel-inset workspace container, desktop sidebar collapse shortcut `⌘B`, mobile navigation drawer sheet, rounded active nav item card, 2-column settings studio with sticky left section rail & wide horizontal label/field rows), `packages/design-system/ui/src/components/{focus-modal/focus-modal.tsx,status-badge/status-badge.tsx,button/button.tsx,command-bar/command-bar.tsx}` (full-screen studio media focus modal, restrained 6px bordered status badges with 6px square dots, clean flat disabled button states, floating single-row selection action bar)
- Applied in: `src/routes/Admin/adminColorTokens.ts`, `src/routes/Admin/AdminShell.tsx`, `src/routes/Admin/AdminShellSidebar.styles.ts`, `src/routes/Admin/AdminShellTopBar.styles.ts`, `src/routes/Admin/AdminSurfacePrimitives.tsx`, `src/routes/Admin/AdminHubSurface.styles.ts`, `src/routes/Admin/AdminPostsWorkspaceList.styles.ts`, `src/routes/Admin/AdminPostsWorkspacePageSections.tsx`, `src/routes/Admin/AdminCloudMediaLightbox.tsx`, `src/routes/Admin/AdminCloudMediaLightbox.styles.ts`, `src/routes/Admin/AdminProfileWorkspacePage.tsx`, `src/routes/Admin/AdminProfileWorkspaceSections.tsx`, `src/routes/Admin/AdminProfileWorkspace.styles.layout.ts`, `src/routes/Admin/AdminProfileWorkspace.styles.sections.ts`
- License: MIT License (Copyright (c) MedusaJS)

## Tremor

- Repository: https://github.com/tremorlabs/tremor
- Reference path: `packages/tremor-react/src/components/vis-elements/BarList/BarList.tsx` (proportional horizontal bar visualization with tabular values)
- Applied in: `src/routes/Admin/AdminHubSurfaceModel.ts`, `src/routes/Admin/AdminHubSurface.sections.tsx`, `src/routes/Admin/AdminHubSurface.styles.chrome.ts`
- License: Apache License 2.0 (Copyright (c) Tremor Labs)

## Payload CMS

- Repository: https://github.com/payloadcms/payload
- Reference pattern: Admin collection list link-row semantics, `packages/ui/src/elements/ListSelection/` floating sticky bulk selection bar, `packages/ui/src/elements/CommandPalette/` grouped icon palette items, `packages/ui/src/elements/DocumentDiff/` revision comparison diff view, accessible sort/filter controls, row keyboard navigation (`j`/`k`/`x`/`e`), pointer-down Shift range selection, sidebar publish readiness status checklist cards, modular inspector field cards, and on-demand revision restore cards
- Applied in: `src/routes/Admin/AdminCommandPaletteModel.ts`, `src/routes/Admin/AdminCommandPalette.tsx`, `src/routes/Admin/AdminPostsWorkspaceModel.ts`, `src/routes/Admin/AdminPostsWorkspacePageView.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.styles.ts`, `src/routes/Admin/AdminPostsWorkspaceListKeyboard.ts`, `src/routes/Admin/adminPostsWorkspaceBulkModel.ts`, `src/routes/Admin/EditorStudioPublishReadinessCard.tsx`, `src/routes/Admin/EditorStudioDedicatedPanelParts.tsx`, `src/routes/Admin/EditorStudioCloudAssetPicker.tsx`, `src/routes/Admin/EditorStudioRevisionHistoryCard.tsx`, `src/routes/Admin/EditorStudioRevisionDiffPanel.tsx`, `src/routes/Admin/postRevisionDiffModel.ts`
- License: MIT License (Copyright (c) Payload CMS)

## Quartz v4

- Repository: https://github.com/jackyzha0/quartz
- Reference paths: `quartz/plugins/transformers/ofm.ts` (`.expand-button`), `quartz/components/scripts/mermaid.inline.ts` (`DiagramPanZoom`), `quartz/components/scripts/search.inline.ts`
- Applied in: `src/libs/markdown/MarkdownRendererInline.tsx`, `src/libs/markdown/inlineTokenScanners.ts`, `src/libs/markdown/mermaidPanZoom.ts`, `src/libs/markdown/mermaidRuntimeGeometry.ts`, `src/libs/markdown/mermaidRuntimeOverlay.ts`, `src/components/quick-search/QuickSearchPalette.tsx`, `src/components/quick-search/quickSearchHighlight.ts`, `src/routes/Detail/PostDetail/index.tsx`, `src/routes/Detail/PostDetail/PostHeader.tsx`, `src/routes/Detail/PostDetail/PostDetailTocModel.ts`, `src/routes/Detail/PostDetail/PostDetailRailModel.ts`, `src/routes/Detail/PostDetail/PostDetailNavigationModel.ts`, `src/routes/Detail/PostDetail/PostDetailNavigationChrome.tsx`
- License: MIT License (Copyright (c) 2021 Jacky Zhao)

## Mermaid Live Editor

- Repository: https://github.com/mermaid-js/mermaid-live-editor
- Reference paths: `src/lib/components/PanZoomToolbar.svelte`, `src/lib/components/FloatingToolbar.svelte`
- Applied in: `src/libs/markdown/mermaidPanZoom.ts`, `src/libs/markdown/mermaidRuntimeGeometry.ts`, `src/libs/markdown/mermaidRuntimeOverlay.ts`, `src/libs/markdown/components/MarkdownRendererRootMermaidStyles.ts`, `src/components/markdown-editor/markdownEditorLiveTableAndCardTheme.ts`, `src/components/markdown-editor/markdownEditorWidgets.ts`
- License: MIT License (Copyright (c) 2021 Knut Sveidqvist)

## uFuzzy

- Repository: https://github.com/leeoniya/uFuzzy
- Reference pattern: Split-token normalization and single-pass multi-token highlighting
- Applied in: `src/components/quick-search/quickSearchHighlight.ts`
- License: MIT License (Copyright (c) 2022 Leon Sorokin)

## Fumadocs

- Repository: https://github.com/fuma-nama/fumadocs
- Reference path: `packages/core/src/toc.tsx`, `packages/ui/src/components/layout/toc.tsx`, `packages/ui/src/components/callout.tsx`, `packages/ui/src/components/accordion.tsx`, `packages/ui/src/components/card.tsx`, `packages/base-ui/src/components/heading.tsx`, `packages/base-ui/src/components/codeblock.tsx`, search dialog combobox ARIA semantics, semantic admonition cards with vertical accent rail, rotating chevron accordions, structured link/attachment cards, TOC vertical guide rail with active thumb indicator, & reader navigation patterns
- Applied in: `src/libs/markdown/MarkdownRendererSegments.tsx`, `src/libs/markdown/components/HeadingAnchorButton.tsx`, `src/libs/markdown/components/MarkdownRendererRootBaseStyles.ts`, `src/libs/markdown/components/MarkdownRendererRootCalloutStyles.ts`, `src/libs/markdown/components/MarkdownRendererRootCardStyles.ts`, `src/libs/markdown/components/MarkdownRendererRootTableToggleStyles.ts`, `src/libs/markdown/components/MarkdownRendererRootMermaidStyles.ts`, `src/libs/markdown/components/PrettyCodeBlock.tsx`, `src/components/markdown-editor/markdownEditorBlockSvgIcons.ts`, `src/components/markdown-editor/markdownEditorLiveSurfaceCommands.ts`, `src/components/markdown-editor/markdownEditorWidgets.ts`, `src/components/markdown-editor/markdownEditorBlockWidgets.ts`, `src/routes/Detail/PostDetail/index.tsx`, `src/routes/Detail/PostDetail/PostDetail.styles.ts`, `src/routes/Detail/PostDetail/PostDetailDesktopRails.tsx`, `src/routes/Detail/PostDetail/PostDetailTocModel.ts`, `src/routes/Detail/PostDetail/PostDetailRailModel.ts`, `src/routes/Detail/PostDetail/PostDetailRelatedSection.tsx`, `src/routes/Detail/PostDetail/usePostDetailRelatedPosts.ts`, `src/routes/Detail/PostDetail/PostDetailNavigationModel.ts`, `src/routes/Detail/PostDetail/PostDetailNavigationChrome.tsx`, `src/routes/Admin/EditorStudioEditorialStyles.ts`, `src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx`, `src/components/quick-search/QuickSearchPalette.tsx`
- License: MIT License (Copyright (c) 2024 Fuma Nama)

## SilverBullet

- Repository: https://github.com/silverbulletmd/silverbullet
- Reference path: `client/codemirror/decoration_regions.ts`, directive/snippet commands & editor live-status patterns
- Applied in: `src/components/markdown-editor/markdownEditorLiveDecorationRegions.ts`, `src/components/markdown-editor/markdownEditorLiveSurfaceDecorations.ts`, `src/components/markdown-editor/markdownEditorLiveViewportDecorations.ts`, `src/components/markdown-editor/markdownEditorBlockContainerModel.ts`, `src/components/markdown-editor/markdownEditorCardBlockWidgets.ts`, `src/libs/markdown/renderingCardMetadataModel.ts`, `src/routes/Admin/editorStudioDedicatedSurfaceModel.ts`
- License: MIT License (Copyright (c) 2022 Zef Hemel / SilverBullet contributors)

## CodeMirror 6 (`@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/search`)

- Repositories: https://github.com/codemirror/view, https://github.com/codemirror/lang-markdown, https://github.com/codemirror/search
- Reference patterns: `ViewPlugin.fromClass`, `view.visibleRanges` viewport-scoped decoration updates, blockquote/list/fenced-code Enter commands (`insertNewlineContinueMarkup`), compact inline search & replace panel layout
- Applied in: `src/components/markdown-editor/markdownEditorLiveViewportDecorations.ts`, `src/components/markdown-editor/markdownEditorKeyboardModel.ts`, `src/components/markdown-editor/markdownEditorListCommandsModel.ts`, `src/components/markdown-editor/markdownEditorFenceCommands.ts`, `src/components/markdown-editor/MarkdownEditorFindReplace.tsx`, `src/components/markdown-editor/MarkdownEditorFindReplace.styles.ts`
- License: MIT License (Copyright (c) 2018-2026 Marijn Haverbeke and contributors)

## Turndown

- Repository: https://github.com/mixmark-io/turndown
- Reference pattern: Recursive DOM-to-Markdown element serialization (`blockquote`, `hr`, `mark`, task-list checkbox items) with Fail-Closed URL scheme sanitization
- Applied in: `src/components/markdown-editor/markdownEditorHtmlPasteModel.ts`
- License: MIT License (Copyright (c) 2017 Dom Christie)

## Starlight

- Repository: https://github.com/withastro/starlight
- Reference pattern: `packages/starlight/components/SkipLink.astro` keyboard skip navigation, code frame / Expressive Code progressive enhancement, `MobileTableOfContents` sticky section bar
- Applied in: `src/layouts/RootLayout/index.tsx`, `src/libs/markdown/useTrustedHtmlCodeBlocksEffect.ts`, `src/routes/Detail/PostDetail/PostDetailMobileToc.tsx`
- License: MIT License (Copyright (c) 2023 Astro Contributors)

## Shiki (`@shikijs/transformers`)

- Repository: https://github.com/shikijs/shiki
- Reference path: `packages/transformers/src/transformers/notation-diff.ts`, `meta-highlight.ts`, `meta-highlight-word.ts`
- Applied in: `src/libs/markdown/codeBlockMetaScanner.ts`, `src/libs/markdown/prismRuntime.ts`, `src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts`
- License: MIT License (Copyright (c) 2021 Pine Wu, Anthony Fu)

## VitePress

- Repository: https://github.com/vuejs/vitepress
- Reference path: `src/node/markdown/plugins/preWrapper.ts`
- Applied in: `src/libs/markdown/codeBlockMetaScanner.ts`, `src/libs/markdown/renderingCodeModel.ts`
- License: MIT License (Copyright (c) 2019-present Evan You & VitePress Contributors)

## medium-zoom & PhotoSwipe

- Repositories: https://github.com/francoischalifour/medium-zoom, https://github.com/dimsemenov/PhotoSwipe
- Reference path: `medium-zoom` overlay stage and `PhotoSwipe` 2-pointer pinch-to-zoom distance tracking & double-tap zoom toggle
- Applied in: `src/libs/markdown/imageLightboxOverlay.ts`, `src/libs/markdown/mermaidPanZoom.ts`
- License: MIT License (Copyright (c) 2017 François Chalifour, Copyright (c) 2014-2024 Dmitry Semenov)

## Docusaurus

- Repository: https://github.com/facebook/docusaurus
- Reference path: `packages/docusaurus-theme-classic/src/theme/BackToTopButton/index.tsx`, `packages/docusaurus-theme-common/src/hooks/useCodeWordWrap.ts`, `packages/docusaurus-theme-classic/src/theme/CodeBlock/Buttons/WordWrapButton/index.tsx`, `packages/docusaurus-theme-classic/src/theme/CodeBlock/Buttons/CopyButton/index.tsx`, `packages/docusaurus-theme-classic/src/theme/Heading/index.tsx`
- Applied in: `src/libs/markdown/components/PrettyCodeBlock.tsx`, `src/libs/markdown/useTrustedHtmlCodeBlocksEffect.ts`, `src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts`, `src/libs/markdown/MarkdownRendererComponents.tsx`, `src/routes/Detail/PostDetail/index.tsx`, `src/routes/Detail/PostDetail/PostDetailNavigationChrome.tsx`
- License: MIT License (Copyright (c) Meta Platforms, Inc. and affiliates.)

## paste-markdown

- Repository: https://github.com/github/paste-markdown
- Reference path: `src/paste-markdown-table.ts`
- Applied in: `src/components/markdown-editor/markdownEditorTsvTablePasteModel.ts`, `src/components/markdown-editor/useMarkdownEditorMediaTransfers.ts`
- License: MIT License (Copyright (c) 2018 GitHub, Inc.)

## Material for MkDocs

- Repository: https://github.com/squidfunk/mkdocs-material
- Reference path: `src/templates/assets/javascripts/components/content/tabs/index.ts`
- Applied in: `src/routes/Admin/adminTablistKeyboard.ts`, `src/routes/Admin/AdminToolsDiagnosticsSection.tsx`, `src/routes/Admin/AdminToolsExecutionSection.tsx`
- License: MIT License (Copyright (c) 2016-2026 Martin Donath)

## Strapi & Phosphor Icons (`@strapi/icons`)

- Repositories: https://github.com/strapi/strapi, https://github.com/phosphor-icons/core
- Reference paths: `packages/core/upload/admin/src/pages/Assets/` (`AssetsPage.tsx`, `components/AssetsGrid.tsx`, `components/AssetsTable.tsx`, `components/ViewToggle.tsx`, `components/EmptyState.tsx`, `components/AssetDetails/AssetPreview.tsx`, `components/AssetDetails/AssetDetailsDrawer.tsx`), `packages/core/upload/admin/src/components/UploadProgressDialog.tsx`, `packages/core/upload/admin/src/utils/getAssetIcon.ts`, and `phosphor-icons/core` `assets/regular/*.svg` (`256×256` `@strapi/icons` vectors)
- Applied in: `src/apis/backend/cloud.ts`, `src/routes/Admin/adminStrapiIcons.tsx`, `src/routes/Admin/AdminCloudAssetGrid.tsx`, `src/routes/Admin/AdminCloudWorkspacePage.tsx`, `src/routes/Admin/AdminCloudWorkspace.styles.ts`, `src/routes/Admin/AdminCloudWorkspaceDetailDrawer.tsx`, `src/routes/Admin/AdminCloudPreviewDrawer.tsx`, `src/routes/Admin/AdminCloudUploadQueue.tsx`, `src/routes/Admin/EditorStudioCloudAssetPicker.tsx`
- Licenses: MIT License (Copyright (c) 2015-present Strapi Solutions SAS; Copyright (c) 2020 Phosphor Icons)

## Yet Another React Lightbox

- Repository: https://github.com/igordanchenko/yet-another-react-lightbox
- Reference paths: `src/styles.scss`, `src/_common.scss`, `src/components/Icons.tsx`, `src/modules/Toolbar.tsx`, `src/modules/Navigation/Navigation.tsx`, `src/plugins/counter/Counter.tsx`, `src/plugins/counter/counter.scss`, `src/plugins/zoom/ZoomButton.tsx`, `src/plugins/download/DownloadButton.tsx`, `src/plugins/fullscreen/FullscreenButton.tsx`
- Applied in: `src/routes/Admin/adminStrapiIcons.tsx`, `src/routes/Admin/AdminCloudMediaLightbox.tsx`, `src/routes/Admin/AdminCloudMediaLightbox.styles.ts`, `src/libs/markdown/imageLightboxOverlay.ts`
- License: MIT License (Copyright (c) 2022 Igor Danchenko)

## Uppy

- Repository: https://github.com/transloadit/uppy
- Reference path: `packages/@uppy/xhr-upload`, `packages/@uppy/utils/src/emaFilter.ts`, `packages/@uppy/core/src/Uppy.ts` (full-area drag-and-drop overlay state, parallel upload queue scheduler, XHR byte progress & EMA transfer speed/ETA estimation, file signature pre-validation, and exponential backoff / `Retry-After` retry for chunk uploads)
- Applied in: `src/apis/backend/cloud.ts`, `src/apis/backend/cloudXhrTransport.ts`, `src/apis/backend/cloudVideoUpload.ts`, `src/routes/Admin/AdminCloudWorkspace.styles.ts`, `src/routes/Admin/AdminCloudUploadQueue.tsx`, `src/routes/Admin/cloudUploadQueueModel.ts`, `src/routes/Admin/useAdminCloudUploadQueue.ts`, `src/routes/Admin/cloudFileSignatureGuard.ts`
- License: MIT License (Copyright (c) 2026 Transloadit Ltd and Acquired Trends)

## Supabase Storage Explorer

- Repository: https://github.com/supabase/supabase
- Reference path: `apps/studio/components/interfaces/Storage/` (`StorageExplorer/`, `CustomExpiryModal.tsx`, `FileExplorerHeader.tsx`, `StorageMenuV2.tsx` — always-inline desktop inspector layout, custom-expiry share-link modal, virtual folder path navigation, and batch action coordination)
- Applied in: `src/apis/backend/cloud.ts`, `src/routes/Admin/AdminCloudWorkspacePage.tsx`, `src/routes/Admin/AdminCloudWorkspaceDetailDrawer.tsx`, `src/routes/Admin/AdminCloudPreviewDrawer.tsx`, `src/routes/Admin/cloud/CloudShareLinkModal.tsx`, `src/routes/Admin/cloud/AdminCloudOverlay.styles.ts`
- License: Apache License 2.0 (Copyright (c) 2020-present Supabase, Inc.)

## FileBrowser

- Repository: https://github.com/filebrowser/filebrowser
- Reference path: `frontend/src/components/prompts/` (`NewDir.vue`, `Move.vue`, `Rename.vue`), `frontend/src/components/files/ListingItem.vue`, `frontend/src/components/ContextMenu.vue` (breadcrumb folder bar, modal prompt ergonomics, context menu positioning & keyboard actions, sortable file table headers, and Ctrl/⌘+V paste upload)
- Applied in: `src/routes/Admin/cloud/cloudFolderHelpers.ts`, `src/routes/Admin/cloud/CloudBreadcrumbBar.tsx`, `src/routes/Admin/cloud/CloudFolderModals.tsx`, `src/routes/Admin/cloud/CloudContextMenu.tsx`, `src/routes/Admin/cloud/CloudFloatingBulkBar.tsx`, `src/routes/Admin/cloud/CloudFileTableSection.tsx`, `src/routes/Admin/cloud/useCloudWorkspaceUrlAndShortcuts.ts`
- License: Apache License 2.0 (Copyright (c) 2016-present FileBrowser Contributors)

## PDF.js (`pdfjs-dist` & CMap Assets)

- Repository: https://github.com/mozilla/pdf.js
- Reference path: `external/bcmaps/` (CJK character map `.bcmap` assets served under `public/pdfjs/cmaps/` and configured via `cMapUrl` / `cMapPacked` for Korean/CJK PDF rendering)
- Applied in: `public/pdfjs/cmaps/`, `src/routes/Admin/cloud/cloudPreviewHelpers.ts`, `src/routes/Admin/cloud/CloudPdfLightboxStage.tsx`
- License: Apache License 2.0 (Copyright (c) 2012-present Mozilla Foundation)

## cmdk & github/hotkey

- Repositories: https://github.com/pacocoursey/cmdk, https://github.com/github/hotkey
- Reference pattern: Single-pass ASCII token matching, grouped icon command list with active-item `scrollIntoView`, capture-phase focus trap, and 2-key sequence shortcut state machine
- Applied in: `src/components/quick-search/QuickSearchPalette.tsx`, `src/components/quick-search/QuickSearchPalette.styles.ts`, `src/routes/Admin/AdminCommandPaletteModel.ts`, `src/routes/Admin/AdminCommandPalette.tsx`, `src/routes/Admin/AdminSequenceHotkey.ts`, `src/routes/Admin/AdminShell.tsx`
- License: MIT License (Copyright (c) 2022 Paco Coursey, Copyright (c) 2018 GitHub, Inc.)

## react-easy-crop & cropperjs

- Repositories: https://github.com/ValentinH/react-easy-crop, https://github.com/fengyuanchen/cropperjs
- Reference pattern: Dark-masked circular cropper stage (`src/Cropper.tsx`, `src/styles.css`), 3×3 rule-of-thirds guide grid, non-passive wheel zoom clamping, arrow-key translation with shift multiplier, and boundary constraining
- Applied in: `src/routes/Admin/cropKeyboardWheelHelper.ts`, `src/routes/Admin/AdminProfileImageEditorModal.tsx`, `src/routes/Admin/AdminProfileWorkspace.styles.sections.ts`, `src/routes/Admin/EditorStudioThumbnailPanels.tsx`
- License: MIT License (Copyright (c) 2019 Valentin Hervieu, Copyright (c) 2015-present Chen Fengyuan)

## bull-board

- Repository: https://github.com/felixmosh/bull-board
- Reference pattern: `packages/ui/src/components/QueueCard/` (`QueueCard.tsx`, `QueueCard.module.css`, `QueueStats/QueueStats.tsx`, `QueueStats/QueueStats.module.css`), `StatusMenu/StatusMenu.tsx`, `CollapsibleJSON` — `8px` horizontal `.pulse` runtime proportion bar, `QueueCard` header + 2-column stats/proportions card body, `#09090b` monospace live logs terminal, underline diagnostic status tabs, expandable DLQ `JobCard` error stack details, and live operation polling indicators
- Applied in: `src/routes/Admin/adminColorTokens.ts`, `src/routes/Admin/AdminBullQueueCards.tsx`, `src/routes/Admin/AdminHubSurface.sections.tsx`, `src/routes/Admin/AdminDashboardWorkspaceView.tsx`, `src/routes/Admin/AdminDashboardWorkspace.styles.panels.ts`, `src/routes/Admin/AdminToolsOpsOverview.tsx`, `src/routes/Admin/AdminToolsWorkspacePage.tsx`, `src/routes/Admin/AdminToolsWorkspace.styles.ts`, `src/routes/Admin/AdminToolsDiagnosticsSection.tsx`, `src/routes/Admin/AdminToolsExecutionSection.tsx`, `src/routes/Admin/AdminTaskDlqReplayModel.ts`, `src/routes/Admin/AdminTaskDlqTable.tsx`, `src/routes/Admin/AdminTaskDlqReplaySection.tsx`, `src/routes/Admin/AdminSearchRuntimeControlSection.tsx`, `src/routes/Admin/useAdminOperationPolling.ts`
- License: MIT License (Copyright (c) 2020 Felix Moshkovich)

## AstroPaper, tailwind-nextjs-starter-blog & hugo-PaperMod

- Repositories: https://github.com/satnaing/astro-paper, https://github.com/timlrx/tailwind-nextjs-starter-blog, https://github.com/adityatelange/hugo-PaperMod
- Reference patterns: Public navigation chrome (`SectionContainer.tsx`, `Header.tsx`, `MobileNav.tsx`, `SearchButton.tsx`), tag sidebar & article feed (`ListLayoutWithTags.tsx`, `Tag.tsx`, `Card.tsx`, `Footer.tsx`), single article layout (`PostLayout.tsx`, `PageTitle.tsx`, `ScrollTopAndComment.tsx`), author profile & error pages (`AuthorLayout.tsx`, `app/not-found.tsx`), dynamic post OpenGraph card layout (`astro-paper` `src/utils/generateOgImages.ts`), and typography-first single post header without duplicate hero banners (`hugo-PaperMod` `cover.hiddenInSingle`)
- Applied in: `src/components/error/ErrorFallbackView.tsx`, `src/layouts/RootLayout/index.tsx`, `src/layouts/RootLayout/Header/index.tsx`, `src/layouts/RootLayout/Header/Logo.tsx`, `src/layouts/RootLayout/Header/NavBar.tsx`, `src/layouts/RootLayout/Header/NavBarMobileMenu.styles.ts`, `src/layouts/RootLayout/Header/NavBarSearchModel.tsx`, `src/pages/about.tsx`, `src/routes/Feed/index.tsx`, `src/routes/Feed/TagList.tsx`, `src/routes/Feed/FeedExplorer.tsx`, `src/routes/Feed/FeedExplorer.styles.ts`, `src/routes/Feed/SearchInput.tsx`, `src/routes/Feed/PostList/index.tsx`, `src/routes/Feed/PostList/PostCard.tsx`, `src/routes/Feed/PostList/PinnedPosts.tsx`, `src/routes/Feed/Footer.tsx`, `src/routes/About/AboutPageView.tsx`, `src/routes/About/AboutPage.styles.ts`, `src/routes/Error/index.tsx`, `src/libs/og/ogUrl.ts`, `src/libs/og/ogCardRenderer.server.ts`, `src/pages/api/og.ts`, `src/routes/Detail/PostDetail/index.tsx`, `src/routes/Detail/PostDetail/PostDetail.styles.ts`, `src/routes/Detail/PostDetail/PostHeader.tsx`, `src/routes/Detail/PostDetail/PostHeader.styles.ts`, `src/routes/Detail/PostDetail/PostDetailSection.styles.ts`, `src/routes/Detail/PostDetail/PostDetailActionSections.tsx`, `src/routes/Detail/PostDetail/postDetailMetadataModel.ts`, `src/routes/Admin/EditorStudioPublishModalParts.tsx`
- Licenses: MIT License (Copyright (c) 2023 Sat Naing, Copyright (c) 2021 Timothy Lin, Copyright (c) 2020 adityatelange)

## next-saas-stripe-starter, Magic UI, Launch UI & shadcn/taxonomy

- Repositories: https://github.com/mickasmt/next-saas-stripe-starter, https://github.com/magicuidesign/magicui, https://github.com/launch-ui/launch-ui, https://github.com/shadcn-ui/taxonomy
- Reference paths: `next-saas-stripe-starter` `components/layout/site-header.tsx`, `components/sections/` (`grid-section.tsx`, `hero-starter.tsx`, `modules-showcase.tsx`, `why-modular.tsx`, `pricing-comparison.tsx`, `closing-cta.tsx`, `site-footer.tsx` — `1080px` vertical architectural border rails, pill announcement hero, modular showcase cards, feature matrix comparison table, closing banner, and multi-column footer); `magicui` `registry/magicui/` (`bento-grid.tsx`, `android.tsx`, `particles.tsx` — `22rem` 3-column BentoGrid cards with hover slide-up CTA reveal, `380×830` `<clipPath>` SVG Android hardware frame, and spatial canvas particle field); `launch-ui` `components/sections/stats/default.tsx` (`tabular-nums` stat strip); `taxonomy` `app/(marketing)/page.tsx` (editorial SaaS marketing cadence and clean white surface tokens)
- Applied in: `src/components/branding/MagicAndroidChrome.tsx`, `src/routes/Company/CompanyPageView.tsx`, `src/routes/Company/CompanyPageModel.ts`, `src/routes/Company/CompanyDownloadPageView.tsx`, `src/routes/Company/CompanyDownloadModel.ts`, `src/routes/Company/CompanyBentoVisuals.tsx`, `src/routes/Company/CompanyCapabilityVisuals.tsx`, `src/routes/Company/CompanyDeviceFrames.tsx`, `src/routes/Company/CompanyFeatureCarousel.tsx`, `src/routes/Company/CompanyHeroParticles.tsx`, `src/routes/Company/CompanyPage.styles.ts`, `src/routes/Company/CompanySection.styles.ts`, `src/routes/Company/CompanyShowcase.styles.ts`, `src/routes/Company/CompanyDownload.styles.ts`, `src/routes/Company/CompanyNews.styles.ts`, `src/routes/Company/useCompanySurfaceMotion.ts`, `src/routes/EasySubway/EasySubwayPageView.tsx`, `src/routes/EasySubway/EasySubwayPage.styles.ts`, `src/routes/EasySubway/EasySubwayFeatures.styles.ts`, `src/routes/EasySubway/EasySubwayScope.styles.ts`, `src/routes/EasySubway/EasySubwayRouteSpecTable.tsx`, `src/routes/EasySubway/EasySubwayTechSpecGrid.tsx`
- Licenses: MIT License (Copyright (c) 2023 Mickasmt, Copyright (c) 2023-present Dillion Verma, Copyright (c) Mikolaj Dobrucki, Copyright (c) 2023 shadcn)

## Sonner & Upptime

- Repositories: https://github.com/emilkowalski/sonner, https://github.com/upptime/upptime
- Reference patterns: Sonner elevated toast notification anatomy (`sonner.tsx` tone icon + clean title/description card) and Upptime 16-slot status bar telemetry visualization
- Applied in: `src/design-system/Toast.tsx`, `src/routes/Company/CompanyBentoVisuals.tsx`
- Licenses: MIT License (Copyright (c) 2023 Emil Kowalski, Copyright (c) 2020 Anand Chowdhary)

## opentype.js

- Repository: https://github.com/opentypejs/opentype.js
- Reference paths: `src/tables/cmap.mjs`, `src/tables/glyf.mjs` (TrueType `sfnt` binary table directory, `cmap` Format 4/12 lookup, and `glyf` simple/composite quadratic Bézier contour decoding)
- Applied in: `src/libs/og/ttfGlyfDecoder.ts`, `src/libs/og/ttfOutlineRenderer.ts`
- License: MIT License (Copyright (c) 2020 Frederik De Bleser)

## Novel

- Repository: https://github.com/steven-tey/novel
- Reference paths: `apps/web/components/tailwind/selectors/link-selector.tsx`, `apps/web/components/tailwind/selectors/text-buttons.tsx`, `apps/web/components/tailwind/slash-command.tsx` (inline selection link editing, URL normalization/validation, floating text bubble, and slash menu patterns)
- Applied in: `src/components/markdown-editor/MarkdownEditorBubbleLinkPopover.tsx`, `src/components/markdown-editor/MarkdownEditorBlockChrome.tsx`, `src/components/markdown-editor/MarkdownEditorBlockChrome.styles.ts`, `src/components/markdown-editor/MarkdownEditorBlockMenuPopover.tsx`, `src/components/markdown-editor/MarkdownEditorSlashMenu.tsx`, `src/components/markdown-editor/MarkdownEditorIcons.tsx`
- License: Apache License 2.0 (Copyright (c) 2024 Steven Tey)

## Milkdown Crepe

- Repository: https://github.com/Milkdown/milkdown
- Reference paths: `packages/crepe/src/feature/toolbar/`, `packages/crepe/src/feature/table/`, `packages/crepe/src/theme/common/` (`top-bar.css`, `toolbar.css`, `block-edit.css`, `link-tooltip.css`, `table.css`, `code-mirror.css` — sticky top formatting bar, `6×6` interactive table picker, selection bubble toolbar, pill table grip handles, contextual table button-group toolbar, multi-layer floating elevation shadows, underline tabbed `.milkdown-slash-menu`, and gutter handle UX)
- Applied in: `src/components/markdown-editor/MarkdownEditor.tsx`, `src/components/markdown-editor/MarkdownEditor.styles.ts`, `src/components/markdown-editor/MarkdownEditorToolbar.tsx`, `src/components/markdown-editor/MarkdownEditorToolbar.styles.ts`, `src/components/markdown-editor/MarkdownEditorToolbarIconsMap.tsx`, `src/components/markdown-editor/MarkdownEditorTablePopover.tsx`, `src/components/markdown-editor/useMarkdownEditorPanelPosition.ts`, `src/components/markdown-editor/MarkdownEditorBlockChrome.tsx`, `src/components/markdown-editor/MarkdownEditorBlockChrome.styles.ts`, `src/components/markdown-editor/MarkdownEditorBlockMenuPopover.tsx`, `src/components/markdown-editor/MarkdownEditorSlashMenu.tsx`, `src/components/markdown-editor/markdownEditorSlashMenuModel.ts`, `src/components/markdown-editor/MarkdownEditorBubbleLinkPopover.tsx`, `src/components/markdown-editor/MarkdownEditorIcons.tsx`, `src/components/markdown-editor/markdownEditorBlockSvgIcons.ts`, `src/components/markdown-editor/markdownEditorTableWidgetDom.ts`, `src/components/markdown-editor/markdownEditorLiveTableAndCardTheme.ts`
- License: MIT License (Copyright (c) 2021 Mirone)

## MarkText

- Repository: https://github.com/marktext/marktext
- Reference patterns: Focus mode active-paragraph isolation, typewriter bottom scroll clearance (`42vh`), and typing-triggered chrome auto-dimming (`focusMode.less`, `typewriterMode`)
- Applied in: `src/routes/Admin/editorStudioWritingFocus.ts`, `src/routes/Admin/editorStudioDedicatedSurfaceModel.ts`, `src/components/markdown-editor/MarkdownEditor.styles.ts`, `src/components/markdown-editor/markdownEditorBlockModel.ts`, `src/components/markdown-editor/MarkdownEditorBlockChrome.tsx`
- License: MIT License (Copyright (c) 2017-present Jocs)

## Koenig Editor

- Repository: https://github.com/TryGhost/Koenig
- Reference paths: `packages/koenig-lexical/` (`FormatToolbar.tsx`, `CardMenu.tsx`, `FloatingLinkToolbar.tsx`, `components/ui/FeatureImage.jsx`, `BookmarkCard`, `ToggleCard`, `FileCard` — 740px centered editorial reading sheet, full-width hero feature image slot above post title, toolbar pill separation, minimal top bar chrome, structured bookmark/toggle/file cards, markdown shortcut reference sheet, and revision history panel patterns)
- Applied in: `src/libs/markdown/MarkdownRendererSegments.tsx`, `src/libs/markdown/components/MarkdownRendererRootCardStyles.ts`, `src/libs/markdown/components/MarkdownRendererRootTableToggleStyles.ts`, `src/routes/Admin/EditorStudioFeatureImageBar.tsx`, `src/routes/Admin/EditorStudioEditorialStyles.ts`, `src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx`, `src/routes/Admin/EditorStudioGuideModal.tsx`, `src/routes/Admin/EditorStudioRevisionHistoryCard.tsx`, `src/components/markdown-editor/MarkdownEditor.styles.ts`, `src/components/markdown-editor/MarkdownEditorReadingPreview.tsx`, `src/components/markdown-editor/MarkdownEditorToolbar.styles.ts`, `src/components/markdown-editor/MarkdownEditorIcons.tsx`, `src/components/markdown-editor/markdownEditorBlockWidgets.ts`, `src/components/markdown-editor/markdownEditorLiveTableAndCardTheme.ts`
- License: MIT License (Copyright (c) Ghost Foundation)

## Lucide Icons

- Repository: https://github.com/lucide-icons/lucide
- Reference paths: `icons/*.svg` (`24×24` monochrome SVG icon geometry used across public shell, feed, article detail, markdown renderer, lightbox, marketing, admin studio, and markdown editor controls)
- Applied in: `src/components/icons/AppIcon.tsx`, `src/components/ProfileImage.tsx`, `src/components/branding/BrandMark.tsx`, `src/design-system/Toast.tsx`, `src/layouts/RootLayout/Header/NavBarSearchModel.tsx`, `src/components/quick-search/QuickSearchPalette.tsx`, `src/pages/about.tsx`, `src/routes/Feed/Footer.tsx`, `src/routes/Feed/FeedExplorer.tsx`, `src/routes/Feed/PostList/PostCard.tsx`, `src/routes/Feed/PostList/InitialLoadErrorState.tsx`, `src/routes/Detail/PostDetail/PostHeader.tsx`, `src/routes/Detail/PostDetail/PostDetailMobileToc.tsx`, `src/routes/Detail/PostDetail/PostDetailNavigationChrome.tsx`, `src/routes/Detail/PostDetail/PostDetailRelatedSection.tsx`, `src/libs/markdown/MarkdownRendererSegments.tsx`, `src/libs/markdown/MarkdownRendererFootnotes.tsx`, `src/libs/markdown/components/HeadingAnchorButton.tsx`, `src/libs/markdown/components/PrettyCodeBlock.tsx`, `src/libs/markdown/imageLightboxOverlay.ts`, `src/libs/markdown/mermaidPanZoom.ts`, `src/libs/markdown/mermaidRuntimeOverlay.ts`, `src/routes/EasySubway/EasySubwayPageView.tsx`, `src/routes/EasySubway/EasySubwayTechSpecGrid.tsx`, `src/routes/Company/CompanyIcons.tsx`, `src/routes/Company/CompanyDeviceFrames.tsx`, `src/routes/Admin/AdminAppIcon.tsx`, `src/routes/Admin/AdminProfileIcon.tsx`, `src/components/markdown-editor/MarkdownEditorIcons.tsx`, `src/components/markdown-editor/MarkdownEditorFindReplace.tsx`, `src/components/markdown-editor/markdownEditorBlockSvgIcons.ts`, `src/components/markdown-editor/markdownEditorWidgets.ts`, `public/images/default-profile.svg`
- License: ISC License (Copyright (c) 2013-2022 Cole Bemis as part of Feather (MIT); Copyright (c) 2022 Lucide Contributors)

## Simple Icons

- Repository: https://github.com/simple-icons/simple-icons
- Reference paths: `icons/apple.svg`, `icons/windows.svg`, `icons/linux.svg`, `icons/github.svg`, `icons/kakaotalk.svg` (`24×24` monochrome brand silhouettes)
- Applied in: `src/routes/Company/CompanyIcons.tsx`, `src/routes/Admin/AdminProfileIcon.tsx`, `src/pages/about.tsx`, `src/routes/Feed/Footer.tsx`
- License: CC0 1.0 Universal (Public Domain Dedication)

## IBM Plex Sans KR

- Repository: https://github.com/IBM/plex (`google/fonts` `ofl/ibmplexsanskr`)
- Asset path: `public/fonts/IBMPlexSansKR-SemiBold.ttf`, `public/fonts/OFL.txt`
- License: SIL Open Font License 1.1 (Copyright (c) 2019 IBM Corp.; see `public/fonts/OFL.txt`)


---

## Standard MIT License Text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
