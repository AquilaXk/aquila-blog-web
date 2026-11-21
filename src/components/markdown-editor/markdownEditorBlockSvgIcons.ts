/**
 * 참조 구현:
 * - lucide-icons/lucide icons/*.svg (ISC License, Copyright (c) Lucide Contributors) — 24×24 원본 벡터
 * - fuma-nama/fumadocs packages/base-ui/src/components/callout.tsx (MIT License, Copyright (c) 2024 Fuma Nama)
 * - Milkdown/milkdown packages/crepe/src/feature/table/ (MIT License, Copyright (c) 2021 Mirone)
 * - TryGhost/Koenig packages/koenig-lexical/ (MIT License, Copyright (c) Ghost Foundation)
 */

const svgWrap = (size: number, strokeWidth: number, body: string): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

export const LIVE_CALLOUT_SVG_BY_TONE: Readonly<Record<string, string>> = {
  tip: svgWrap(
    18,
    1.85,
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'
  ),
  info: svgWrap(
    18,
    1.85,
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  ),
  warning: svgWrap(
    18,
    1.85,
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  ),
  danger: svgWrap(
    18,
    1.85,
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>'
  ),
  example: svgWrap(
    18,
    1.85,
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
  ),
  summary: svgWrap(
    18,
    1.85,
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
  ),
  outline: svgWrap(
    18,
    1.85,
    '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>'
  ),
  purple: svgWrap(
    18,
    1.85,
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'
  ),
}

export const getLiveCalloutIconSvg = (tone: string): string =>
  LIVE_CALLOUT_SVG_BY_TONE[tone] ?? LIVE_CALLOUT_SVG_BY_TONE.info!

export const LIVE_BLOCK_UI_SVGS = {
  chevronDown: svgWrap(14, 2, '<path d="m6 9 6 6 6-6"/>'),
  bookmark: svgWrap(
    18,
    1.75,
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
  ),
  embed: svgWrap(
    18,
    1.75,
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"/>'
  ),
  file: svgWrap(
    18,
    1.75,
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>'
  ),
  externalLink: svgWrap(14, 1.9, '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  link: svgWrap(
    12,
    2,
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  ),
} as const

export const LIVE_TABLE_TOOLBAR_SVGS = {
  headerRow: svgWrap(14, 1.85, '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/>'),
  headerCol: svgWrap(14, 1.85, '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'),
  fitWidth: svgWrap(14, 1.85, '<path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/>'),
  alignLeft: svgWrap(14, 1.9, '<path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/>'),
  alignCenter: svgWrap(14, 1.9, '<path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/>'),
  alignRight: svgWrap(14, 1.9, '<path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/>'),
  insertRowAbove: svgWrap(
    14,
    1.9,
    '<rect width="13" height="7" x="8" y="3" rx="1"/><path d="m2 9 3 3-3 3"/><rect width="13" height="7" x="8" y="14" rx="1"/>'
  ),
  insertRowBelow: svgWrap(
    14,
    1.9,
    '<rect width="13" height="7" x="3" y="3" rx="1"/><path d="m22 15-3-3 3-3"/><rect width="13" height="7" x="3" y="14" rx="1"/>'
  ),
  moveUp: svgWrap(14, 1.9, '<path d="m18 15-6-6-6 6"/>'),
  moveDown: svgWrap(14, 1.9, '<path d="m6 9 6 6 6-6"/>'),
  insertColLeft: svgWrap(
    14,
    1.9,
    '<rect width="7" height="13" x="3" y="8" rx="1"/><path d="m15 2-3 3-3-3"/><rect width="7" height="13" x="14" y="8" rx="1"/>'
  ),
  insertColRight: svgWrap(
    14,
    1.9,
    '<rect width="7" height="13" x="3" y="3" rx="1"/><path d="m9 22 3-3 3 3"/><rect width="7" height="13" x="14" y="3" rx="1"/>'
  ),
  moveLeft: svgWrap(14, 1.9, '<path d="m15 18-6-6 6-6"/>'),
  moveRight: svgWrap(14, 1.9, '<path d="m9 18 6-6-6-6"/>'),
  duplicate: svgWrap(
    14,
    1.85,
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
  ),
  clear: svgWrap(
    14,
    1.85,
    '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>'
  ),
  trash: svgWrap(
    14,
    1.85,
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  ),
  code: svgWrap(14, 1.9, '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
  plus: svgWrap(13, 2, '<path d="M5 12h14"/><path d="M12 5v14"/>'),
  gripHorizontal: svgWrap(
    14,
    2,
    '<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/>'
  ),
  gripVertical: svgWrap(
    14,
    2,
    '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>'
  ),
} as const
