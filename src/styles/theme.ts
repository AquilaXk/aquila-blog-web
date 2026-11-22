import { Theme } from "@emotion/react"
import { Colors, colors } from "./colors"
import { variables } from "./variables"
import { zIndexes } from "./zIndexes"
import type { BlogDesignType, SchemeType } from "src/types"

export type PublicDesignTokens = {
  pageBackgroundColor: string
  pageBackgroundImage: string
  surface: string
  surfaceElevated: string
  readableSurface: string
  operationSurface: string
  operationSurfaceElevated: string
  border: string
  borderStrong: string
  accent: string
  accentHover: string
  accentMuted: string
  inlineCodeBg: string
  inlineCodeBorder: string
  shadow: string
}

declare module "@emotion/react" {
  export interface Theme {
    scheme: SchemeType
    blogDesign: BlogDesignType
    publicDesign: PublicDesignTokens
    colors: Colors
    zIndexes: typeof zIndexes
    variables: typeof variables
  }
}

type Options = {
  scheme: SchemeType
  blogDesign?: BlogDesignType
}

export const createPublicDesignTokens = (_scheme: SchemeType = "light"): PublicDesignTokens => {
  const schemeColors = colors.light

  return {
    pageBackgroundColor: "#f7f7f5",
    pageBackgroundImage: "none",
    surface: schemeColors.gray1,
    surfaceElevated: "#f0f1f2",
    readableSurface: "#ffffff",
    operationSurface: schemeColors.gray1,
    operationSurfaceElevated: schemeColors.gray2,
    border: "#dfe1e5",
    borderStrong: "#c8ccd2",
    accent: "#155eef",
    accentHover: "#0d4ed8",
    accentMuted: "#edf4ff",
    inlineCodeBg: "rgba(15, 23, 36, 0.055)",
    inlineCodeBorder: "rgba(15, 23, 36, 0.12)",
    shadow: variables.ui.card.shadow,
  }
}

export const createTheme = (options: Options): Theme => ({
  scheme: options.scheme,
  blogDesign: options.blogDesign ?? "legacy",
  publicDesign: createPublicDesignTokens(options.scheme),
  colors: colors[options.scheme],
  variables: variables,
  zIndexes: zIndexes,
})
