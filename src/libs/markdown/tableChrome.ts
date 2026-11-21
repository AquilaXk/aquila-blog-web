import { tableChromeTokens } from "src/design-system/tokens"

type ThemeLike = {
  colors: Record<string, string>
  scheme?: "light" | "dark"
}

export const TABLE_SHARED_RADIUS_PX = 12
export const TABLE_SHARED_MARGIN_Y = "1rem"

export const getTableChromePalette = (theme: ThemeLike) => ({
  border: theme.colors.gray6,
  background: tableChromeTokens.lightBackground,
  shadow: tableChromeTokens.lightShadow,
  hoverBorder: tableChromeTokens.hoverBorder,
  hoverRing: tableChromeTokens.hoverRing,
  headerBackground: theme.colors.gray3,
  headerRule: tableChromeTokens.lightHeaderRule,
})
