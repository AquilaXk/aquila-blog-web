// 참조 구현: TryGhost/Ghost apps/admin/src/layout/admin-frame.tsx & index.css (MIT), shadcn-ui/ui apps/v4 new-york-v4 zinc tokens (MIT), strapi/strapi AssetsGrid.tsx (MIT)
import type { Theme } from "@emotion/react"
import { colors, createPublicDesignTokens } from "src/styles"

const c = colors.light
const d = createPublicDesignTokens("light")

const adminLightThemeVariables = `
  color-scheme: light;
  --admin-frame-bg: #09090b;
  --admin-frame-fg: #fafafa;
  --admin-frame-muted: #a1a1aa;
  --admin-frame-pill-bg: rgba(255, 255, 255, 0.08);
  --admin-frame-pill-hover: rgba(255, 255, 255, 0.14);
  --admin-frame-pill-border: rgba(255, 255, 255, 0.12);
  --admin-app-bg: ${d.surface};
  --admin-sidebar-bg: #fafafa;
  --admin-surface: ${d.surface};
  --admin-surface-raised: #f8f8fa;
  --admin-surface-muted: #f4f4f5;
  --admin-surface-accent: #f4f4f5;
  --admin-elevated-top: ${c.gray1};
  --admin-border: #e4e4e7;
  --admin-border-subtle: #f1f1f4;
  --admin-border-strong: #d4d4d8;
  --admin-text-primary: #09090b;
  --admin-text-secondary: #52525b;
  --admin-text-muted: #52525b;
  --admin-primary: #18181b;
  --admin-primary-hover: #27272a;
  --admin-accent-text: #18181b;
  --admin-primary-border: #18181b;
  --admin-primary-border-hover: #27272a;
  --admin-control-text: #fafafa;
  --admin-focus-ring: rgba(24, 24, 27, 0.16);
  --admin-focus-ring-strong: rgba(24, 24, 27, 0.28);
  --admin-action-group-surface: rgba(255, 255, 255, 0.94);
  --admin-card-gradient: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
  --admin-card-shadow: 0 1px 2px rgba(9, 9, 11, 0.04);
  --admin-inset-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 10px 30px rgba(0, 0, 0, 0.32);
  --admin-floating-shadow: 0 16px 40px rgba(9, 9, 11, 0.18), 0 2px 8px rgba(9, 9, 11, 0.08);
  --admin-command-bar-bg: #18181b;
  --admin-command-bar-border: #27272a;
  --admin-command-bar-fg: #fafafa;
  --admin-command-bar-muted: #a1a1aa;
  --admin-terminal-bg: #09090b;
  --admin-terminal-header-bg: #141417;
  --admin-terminal-border: #27272a;
  --admin-terminal-fg: #e4e4e7;
  --admin-terminal-muted: #a1a1aa;
  --admin-terminal-ok: #6ee7b7;
  --admin-terminal-warn: #fcd34d;
  --admin-terminal-danger: #fda4af;
  --admin-chart-stroke: #18181b;
  --admin-chart-grid: #e4e4e7;
  --admin-chart-area-top: rgba(24, 24, 27, 0.14);
  --admin-chart-area-bottom: rgba(24, 24, 27, 0.01);
  --admin-status-success-text: #047857;
  --admin-status-success-bg: #ecfdf5;
  --admin-status-success-border: rgba(5, 150, 105, 0.28);
  --admin-status-success-dot: #10b981;
  --admin-status-warn-text: #b45309;
  --admin-status-warn-bg: #fffbeb;
  --admin-status-warn-border: rgba(217, 119, 6, 0.32);
  --admin-status-warn-dot: #f59e0b;
  --admin-status-danger-text: #b91c1c;
  --admin-status-danger-bg: #fef2f2;
  --admin-status-danger-border: rgba(220, 38, 38, 0.3);
  --admin-status-danger-dot: #ef4444;
  --admin-status-danger-solid: #dc2626;
  --admin-status-danger-solid-hover: #b91c1c;
  --admin-status-info-text: #1d4ed8;
  --admin-status-info-bg: #eff6ff;
  --admin-status-info-border: rgba(37, 99, 235, 0.26);
  --admin-status-info-dot: #3b82f6;
`

const adminDarkThemeVariables = adminLightThemeVariables

export const adminSystemThemeVariables = (theme: Theme) => `
  ${theme.scheme === "dark" ? adminDarkThemeVariables : adminLightThemeVariables}
`

export const adminFrameBackground = "var(--admin-frame-bg, #09090b)"
export const adminFrameText = "var(--admin-frame-fg, #fafafa)"
export const adminFrameMuted = "var(--admin-frame-muted, #a1a1aa)"
export const adminFramePillBg = "var(--admin-frame-pill-bg)"
export const adminFramePillHover = "var(--admin-frame-pill-hover)"
export const adminFramePillBorder = "var(--admin-frame-pill-border)"
export const adminLoginCanvasBg = "#f4f4f5"
export const adminLoginDotGrid = "radial-gradient(#d4d4d8 1px, transparent 1px)"

export const adminAppBackground = `var(--admin-app-bg, ${d.surface})`
export const adminTextPrimary = "var(--admin-text-primary, #09090b)"
export const adminTextSecondary = "var(--admin-text-secondary, #52525b)"
export const adminTextMuted = "var(--admin-text-muted, #52525b)"
export const adminBorder = "var(--admin-border, #e4e4e7)"
export const adminBorderSubtle = "var(--admin-border-subtle, #f1f1f4)"
export const adminBorderStrong = "var(--admin-border-strong, #d4d4d8)"
export const adminSurface = `var(--admin-surface, ${d.surface})`
export const adminShellSurface = "var(--admin-sidebar-bg, #fafafa)"
export const adminSurfaceRaised = "var(--admin-surface-raised, #f8f8fa)"
export const adminSurfaceMuted = "var(--admin-surface-muted, #f4f4f5)"
export const adminSurfaceAccent = "var(--admin-surface-accent, #f4f4f5)"
export const adminElevatedSurfaceTop = `var(--admin-elevated-top, ${d.surface})`
export const adminElevatedBorderDark = adminBorder
export const adminAccentText = "var(--admin-accent-text, #18181b)"
export const adminGold = adminAccentText
export const adminTeal = "var(--admin-primary, #18181b)"
export const adminTealHover = "var(--admin-primary-hover, #27272a)"
export const adminControlText = "var(--admin-control-text, #fafafa)"
export const adminTealBorder = "var(--admin-primary-border, #18181b)"
export const adminTealBorderHover = "var(--admin-primary-border-hover, #27272a)"
export const adminGoldTintSubtle = adminSurfaceAccent
export const adminGoldTintFocus = "var(--admin-focus-ring)"
export const adminGoldTintFocusStrong = "var(--admin-focus-ring-strong)"
export const adminGoldTintLine = adminTealBorder
export const adminActionGroupLightSurface = "var(--admin-action-group-surface)"
export const adminActionGroupDarkSurface = adminActionGroupLightSurface
export const adminCardGradient = "var(--admin-card-gradient)"
export const adminCardShadow = "var(--admin-card-shadow)"
export const adminInsetShadow = "var(--admin-inset-shadow)"
export const adminFloatingShadow = "var(--admin-floating-shadow)"

export const adminCommandBarBg = "var(--admin-command-bar-bg, #18181b)"
export const adminCommandBarBorder = "var(--admin-command-bar-border, #27272a)"
export const adminCommandBarFg = "var(--admin-command-bar-fg, #fafafa)"
export const adminCommandBarMuted = "var(--admin-command-bar-muted, #a1a1aa)"

export const adminTerminalBg = "var(--admin-terminal-bg, #09090b)"
export const adminTerminalHeaderBg = "var(--admin-terminal-header-bg, #141417)"
export const adminTerminalBorder = "var(--admin-terminal-border, #27272a)"
export const adminTerminalFg = "var(--admin-terminal-fg, #e4e4e7)"
export const adminTerminalMuted = "var(--admin-terminal-muted, #a1a1aa)"
export const adminTerminalOk = "var(--admin-terminal-ok, #6ee7b7)"
export const adminTerminalWarn = "var(--admin-terminal-warn, #fcd34d)"
export const adminTerminalDanger = "var(--admin-terminal-danger, #fda4af)"

export const adminChartStroke = "var(--admin-chart-stroke, #18181b)"
export const adminChartGrid = "var(--admin-chart-grid, #e4e4e7)"
export const adminChartAreaTop = "var(--admin-chart-area-top)"
export const adminChartAreaBottom = "var(--admin-chart-area-bottom)"
export const adminCheckerboardBackground =
  "repeating-conic-gradient(#f4f4f5 0% 25%, #ffffff 0% 50%) 50% / 16px 16px"
export const adminModalBackdropOverlay = "rgba(9, 9, 11, 0.48)"

export const adminStatusSuccessText = "var(--admin-status-success-text, #047857)"
export const adminStatusSuccessBg = "var(--admin-status-success-bg, #ecfdf5)"
export const adminStatusSuccessBorder = "var(--admin-status-success-border)"
export const adminStatusSuccessDot = "var(--admin-status-success-dot, #10b981)"
export const adminStatusWarnText = "var(--admin-status-warn-text, #b45309)"
export const adminStatusWarnBg = "var(--admin-status-warn-bg, #fffbeb)"
export const adminStatusWarnBorder = "var(--admin-status-warn-border)"
export const adminStatusWarnDot = "var(--admin-status-warn-dot, #f59e0b)"
export const adminStatusDangerText = "var(--admin-status-danger-text, #b91c1c)"
export const adminStatusDangerBg = "var(--admin-status-danger-bg, #fef2f2)"
export const adminStatusDangerBorder = "var(--admin-status-danger-border)"
export const adminStatusDangerDot = "var(--admin-status-danger-dot, #ef4444)"
export const adminStatusDangerSolid = "var(--admin-status-danger-solid, #dc2626)"
export const adminStatusDangerSolidHover = "var(--admin-status-danger-solid-hover, #b91c1c)"
export const adminStatusInfoText = "var(--admin-status-info-text, #1d4ed8)"
export const adminStatusInfoBg = "var(--admin-status-info-bg, #eff6ff)"
export const adminStatusInfoBorder = "var(--admin-status-info-border)"
export const adminStatusInfoDot = "var(--admin-status-info-dot, #3b82f6)"

export const usesDarkAdminSurface = (theme: Theme) => theme.scheme !== "light"

export const adminPrimaryText = (_theme: Theme) => adminTextPrimary
export const adminSecondaryText = (_theme: Theme) => adminTextSecondary
export const adminMutedText = (_theme: Theme) => adminTextMuted
export const adminCardBorder = (_theme: Theme) => adminBorder
export const adminStrongBorder = (_theme: Theme) => adminBorderStrong
export const adminPlainSurface = (_theme: Theme) => adminSurface
export const adminRaisedSurface = (_theme: Theme) => adminSurfaceRaised
export const adminMutedSurface = (_theme: Theme) => adminSurfaceMuted
export const adminAccentSurface = (_theme: Theme) => adminSurfaceAccent

export const adminWarningBadgeBorder = () => adminStatusWarnBorder
export const adminWarningBadgeSurface = () => adminStatusWarnBg
export const adminWarningBadgeText = () => adminStatusWarnText

export const adminFocusRing = (theme: Theme, width = 2) =>
  `0 0 0 ${width}px ${theme.scheme === "light" ? adminGoldTintFocus : adminGoldTintFocusStrong}`

export const adminActionGroupSurface = (_theme: Theme) => adminActionGroupLightSurface

export const adminTagChipPalettes = [
  { border: "rgba(24, 24, 27, 0.16)", bg: "#f4f4f5", color: "#18181b" },
  { border: "rgba(144, 101, 176, 0.25)", bg: "#f6f3f9", color: "#5b3678" },
  { border: "rgba(16, 185, 129, 0.25)", bg: "#edf3ec", color: "#255c3e" },
  { border: "rgba(245, 158, 11, 0.28)", bg: "#fbf3db", color: "#78490a" },
  { border: "rgba(235, 87, 87, 0.25)", bg: "#fdebec", color: "#9c2520" },
  { border: "rgba(2, 132, 199, 0.25)", bg: "#e0f2fe", color: "#075985" },
] as const

export const adminCloudSelectionAccent = "#18181b"
