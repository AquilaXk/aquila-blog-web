// 참조 구현: TryGhost/Ghost apps/admin/src/index.css (MIT), medusajs/medusa packages/design-system/ui (MIT), shadcn-ui/ui apps/v4 new-york-v4 zinc tokens (MIT), strapi/strapi AssetsGrid.tsx (MIT)
import type { Theme } from "@emotion/react"
import { colors, createPublicDesignTokens } from "src/styles"

const c = colors.light
const d = createPublicDesignTokens("light")

const adminLightThemeVariables = `
  color-scheme: light;
  --admin-frame-bg: #f4f4f5;
  --admin-outer-canvas: #f4f4f5;
  --admin-frame-fg: #18181b;
  --admin-frame-muted: #52525b;
  --admin-frame-pill-bg: #ffffff;
  --admin-frame-pill-hover: #f4f4f5;
  --admin-frame-pill-border: #e4e4e7;
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
  --admin-text-subtle: #71717a;
  --admin-primary: #18181b;
  --admin-primary-hover: #27272a;
  --admin-accent-text: #18181b;
  --admin-primary-border: #18181b;
  --admin-primary-border-hover: #27272a;
  --admin-control-text: #fafafa;
  --admin-disabled-bg: #f4f4f5;
  --admin-disabled-fg: #71717a;
  --admin-disabled-border: #e4e4e7;
  --admin-bar-fill-subtle: rgba(24, 24, 27, 0.045);
  --admin-focus-ring: rgba(24, 24, 27, 0.14);
  --admin-focus-ring-strong: rgba(24, 24, 27, 0.24);
  --admin-action-group-surface: rgba(255, 255, 255, 0.96);
  --admin-card-gradient: linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
  --admin-card-shadow: 0 1px 2px rgba(9, 9, 11, 0.04);
  --admin-elevated-panel-shadow: 0 4px 16px rgba(9, 9, 11, 0.05), 0 1px 2px rgba(9, 9, 11, 0.03);
  --admin-inset-shadow: 0 1px 2px rgba(9, 9, 11, 0.04);
  --admin-floating-shadow: 0 12px 32px rgba(9, 9, 11, 0.12), 0 1px 3px rgba(9, 9, 11, 0.06);
  --admin-command-bar-bg: #18181b;
  --admin-command-bar-border: #27272a;
  --admin-command-bar-fg: #fafafa;
  --admin-command-bar-muted: #a1a1aa;
  --admin-code-bg: #f8f8fa;
  --admin-code-header-bg: #f4f4f5;
  --admin-code-border: #e4e4e7;
  --admin-code-fg: #18181b;
  --admin-code-muted: #52525b;
  --admin-terminal-bg: #f8f8fa;
  --admin-terminal-header-bg: #f4f4f5;
  --admin-terminal-border: #e4e4e7;
  --admin-terminal-fg: #18181b;
  --admin-terminal-muted: #52525b;
  --admin-terminal-ok: #047857;
  --admin-terminal-warn: #b45309;
  --admin-terminal-danger: #b91c1c;
  --admin-chart-stroke: #18181b;
  --admin-chart-grid: #e4e4e7;
  --admin-chart-area-top: rgba(24, 24, 27, 0.12);
  --admin-chart-area-bottom: rgba(24, 24, 27, 0.01);
  --admin-status-success-text: #047857;
  --admin-status-success-bg: #ecfdf5;
  --admin-status-success-border: rgba(5, 150, 105, 0.24);
  --admin-status-success-dot: #10b981;
  --admin-status-warn-text: #b45309;
  --admin-status-warn-bg: #fffbeb;
  --admin-status-warn-border: rgba(217, 119, 6, 0.26);
  --admin-status-warn-dot: #f59e0b;
  --admin-status-danger-text: #b91c1c;
  --admin-status-danger-bg: #fef2f2;
  --admin-status-danger-border: rgba(220, 38, 38, 0.24);
  --admin-status-danger-dot: #ef4444;
  --admin-status-danger-solid: #dc2626;
  --admin-status-danger-solid-hover: #b91c1c;
  --admin-status-info-text: #1d4ed8;
  --admin-status-info-bg: #eff6ff;
  --admin-status-info-border: rgba(37, 99, 235, 0.22);
  --admin-status-info-dot: #3b82f6;
`

const adminDarkThemeVariables = adminLightThemeVariables

export const adminSystemThemeVariables = (theme: Theme) => `
  ${theme.scheme === "dark" ? adminDarkThemeVariables : adminLightThemeVariables}
`

export const adminFrameBackground = "var(--admin-outer-canvas, #f4f4f5)"
export const adminOuterCanvas = "var(--admin-outer-canvas, #f4f4f5)"
export const adminFrameText = "var(--admin-frame-fg, #18181b)"
export const adminFrameMuted = "var(--admin-frame-muted, #52525b)"
export const adminFramePillBg = "var(--admin-frame-pill-bg)"
export const adminFramePillHover = "var(--admin-frame-pill-hover)"
export const adminFramePillBorder = "var(--admin-frame-pill-border)"
export const adminLoginCanvasBg = "#f4f4f5"
export const adminLoginDotGrid = "radial-gradient(#d4d4d8 1px, transparent 1px)"

export const adminAppBackground = `var(--admin-app-bg, ${d.surface})`
export const adminTextPrimary = "var(--admin-text-primary, #09090b)"
export const adminTextSecondary = "var(--admin-text-secondary, #52525b)"
export const adminTextMuted = "var(--admin-text-muted, #52525b)"
export const adminTextSubtle = "var(--admin-text-subtle, #71717a)"
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
export const adminDisabledBg = "var(--admin-disabled-bg, #f4f4f5)"
export const adminDisabledFg = "var(--admin-disabled-fg, #71717a)"
export const adminDisabledBorder = "var(--admin-disabled-border, #e4e4e7)"
export const adminBarFillSubtle = "var(--admin-bar-fill-subtle, rgba(24, 24, 27, 0.045))"
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
export const adminElevatedPanelShadow = "var(--admin-elevated-panel-shadow)"
export const adminInsetShadow = "var(--admin-inset-shadow)"
export const adminFloatingShadow = "var(--admin-floating-shadow)"

export const adminCommandBarBg = "var(--admin-command-bar-bg, #18181b)"
export const adminCommandBarBorder = "var(--admin-command-bar-border, #27272a)"
export const adminCommandBarFg = "var(--admin-command-bar-fg, #fafafa)"
export const adminCommandBarMuted = "var(--admin-command-bar-muted, #a1a1aa)"

export const adminCodeBg = "var(--admin-code-bg, #f8f8fa)"
export const adminCodeHeaderBg = "var(--admin-code-header-bg, #f4f4f5)"
export const adminCodeBorder = "var(--admin-code-border, #e4e4e7)"
export const adminCodeFg = "var(--admin-code-fg, #18181b)"
export const adminCodeMuted = "var(--admin-code-muted, #52525b)"

export const adminTerminalBg = "var(--admin-terminal-bg, #f8f8fa)"
export const adminTerminalHeaderBg = "var(--admin-terminal-header-bg, #f4f4f5)"
export const adminTerminalBorder = "var(--admin-terminal-border, #e4e4e7)"
export const adminTerminalFg = "var(--admin-terminal-fg, #18181b)"
export const adminTerminalMuted = "var(--admin-terminal-muted, #52525b)"
export const adminTerminalOk = "var(--admin-terminal-ok, #047857)"
export const adminTerminalWarn = "var(--admin-terminal-warn, #b45309)"
export const adminTerminalDanger = "var(--admin-terminal-danger, #b91c1c)"

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
