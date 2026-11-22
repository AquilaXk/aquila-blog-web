/**
 * 참조 구현: lucide-icons/lucide icons/*.svg (ISC License, Copyright (c) Lucide Contributors)
 * 공개 라우트(/, /posts/[id], QuickSearchPalette) 번들 예산을 지키기 위해
 * 런타임에는 공개 표면에서 실제 사용하는 8종 Lucide 24×24 원본 벡터만 포함한다.
 * 관리자·프로필 전용 아이콘은 src/routes/Admin/AdminAppIcon.tsx 및 AdminProfileIcon.tsx에서 분리 로드한다.
 */
import React from "react"

export type PublicIconName =
  | "search"
  | "close"
  | "edit"
  | "service"
  | "question"
  | "heart"
  | "heart-filled"
  | "share"

export type IconName =
  | PublicIconName
  | "tag"
  | "bell"
  | "chevron-down"
  | "chevron-right"
  | "arrow-left"
  | "arrow-right"
  | "external-link"
  | "plus"
  | "refresh"
  | "panel-left"
  | "layout-dashboard"
  | "activity"
  | "wrench"
  | "settings"
  | "terminal"
  | "info"
  | "github"
  | "instagram"
  | "mail"
  | "linkedin"
  | "trash"
  | "message"
  | "kakao"
  | "laptop"
  | "spark"
  | "briefcase"
  | "cloud"
  | "camera"
  | "rocket"
  | "globe"
  | "link"
  | "list"
  | "phone"
  | "file"
  | "folder"
  | "lock"
  | "log-out"

type Props = {
  name: PublicIconName
  className?: string
} & React.SVGProps<SVGSVGElement>

const renderIconChildren = (name: PublicIconName): React.ReactNode => {
  switch (name) {
    case "search":
      return (
        <>
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </>
      )
    case "close":
      return (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      )
    case "edit":
      return (
        <>
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
        </>
      )
    case "service":
      return (
        <>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </>
      )
    case "question":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </>
      )
    case "heart":
    case "heart-filled":
      return (
        <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      )
    case "share":
      return (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </>
      )
    default:
      return null
  }
}

const AppIcon: React.FC<Props> = ({ name, className, ...props }) => {
  const children = renderIconChildren(name)
  if (!children) return null
  const svgDefaults: React.SVGProps<SVGSVGElement> =
    name === "heart-filled"
      ? { fill: "currentColor" }
      : {
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      focusable="false"
      {...svgDefaults}
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export default AppIcon
