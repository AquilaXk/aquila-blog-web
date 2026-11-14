import {
  gray,
  blue,
  red,
  green,
  orange,
  indigo,
} from "@radix-ui/colors"

export type Colors = typeof lightColors

const balancedLightGray = {
  gray1: "#ffffff",
  gray2: "#fcfdff",
  gray3: "#f4f7fb",
  gray4: "#e7edf4",
  gray5: "#d7e0ea",
  gray6: "#c8d2de",
  gray7: "#b5c1ce",
  gray8: "#9ca8b7",
  gray9: "#5c6470",
  gray10: "#566273",
  gray11: "#36414f",
  gray12: "#0f1724",
}

const semanticLight = {
  accentLink: blue.blue10,
  accentControl: "#155eef",
  accentControlHover: blue.blue10,
  accentControlText: "#ffffff",
  accentSurfaceSubtle: blue.blue3,
  accentSurfaceStrong: blue.blue4,
  accentBorder: blue.blue8,
  statusSuccessSurface: green.green3,
  statusSuccessBorder: green.green7,
  statusSuccessText: green.green11,
  statusDangerSurface: red.red3,
  statusDangerBorder: red.red7,
  statusDangerText: red.red11,
}

const lightColors = {
  ...indigo,
  ...gray,
  ...balancedLightGray,
  ...blue,
  ...red,
  ...green,
  ...orange,
  ...semanticLight,
}

// Intentional light-only shell: keep colors.dark type-compatible without bundling @radix-ui/colors *Dark scales.
export const colors = {
  light: lightColors,
  dark: lightColors,
}
