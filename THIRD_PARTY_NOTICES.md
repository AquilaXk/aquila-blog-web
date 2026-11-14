# Third-Party Notices

This repository includes patterns and algorithms adapted from or inspired by the following open-source projects, used in compliance with their MIT License terms.

---

## Ghost

- Repository: https://github.com/TryGhost/Ghost
- Reference path: `ghost/core/server/services/oembed/extract-metadata.ts`
- Applied in: `src/libs/unfurl/extractMeta.ts`
- License: MIT License (Copyright (c) Ghost Foundation)

## Quartz v4

- Repository: https://github.com/jackyzha0/quartz
- Reference paths: `quartz/plugins/transformers/ofm.ts`, `quartz/components/scripts/search.inline.ts`
- Applied in: `src/libs/markdown/MarkdownRendererInline.tsx`, `src/libs/markdown/inlineTokenScanners.ts`, `src/components/quick-search/QuickSearchPalette.tsx`, `src/components/quick-search/quickSearchHighlight.ts`
- License: MIT License (Copyright (c) 2021 Jacky Zhao)

## uFuzzy

- Repository: https://github.com/leeoniya/uFuzzy
- Reference pattern: Split-token normalization and single-pass multi-token highlighting
- Applied in: `src/components/quick-search/quickSearchHighlight.ts`
- License: MIT License (Copyright (c) 2022 Leon Sorokin)

## Fumadocs

- Repository: https://github.com/fuma-nama/fumadocs
- Reference path: `packages/core/src/toc.tsx`
- Applied in: `src/routes/Detail/PostDetail/PostDetailTocModel.ts`
- License: MIT License (Copyright (c) 2024 Fuma Nama)

## SilverBullet

- Repository: https://github.com/silverbulletmd/silverbullet
- Reference path: `client/codemirror/decoration_regions.ts`
- Applied in: `src/components/markdown-editor/markdownEditorLiveDecorationRegions.ts`, `src/components/markdown-editor/markdownEditorLiveSurfaceDecorations.ts`
- License: MIT License (Copyright (c) 2022 Zef Hemel / SilverBullet contributors)

## Starlight

- Repository: https://github.com/withastro/starlight
- Reference pattern: Code frame / Expressive Code progressive enhancement, `MobileTableOfContents` sticky section bar
- Applied in: `src/libs/markdown/useTrustedHtmlCodeBlocksEffect.ts`, `src/routes/Detail/PostDetail/PostDetailMobileToc.tsx`
- License: MIT License (Copyright (c) 2023 Astro Contributors)

## Shiki (`@shikijs/transformers`)

- Repository: https://github.com/shikijs/shiki
- Reference path: `packages/transformers/src/transformers/notation-diff.ts` (`transformerNotationDiff`)
- Applied in: `src/libs/markdown/prismRuntime.ts`
- License: MIT License (Copyright (c) 2021 Pine Wu, Anthony Fu)

## medium-zoom

- Repository: https://github.com/francoischalifour/medium-zoom
- Reference path: `src/medium-zoom.js`
- Applied in: `src/libs/markdown/imageLightboxOverlay.ts`
- License: MIT License (Copyright (c) 2017 François Chalifour)

---

## Standard MIT License Text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
