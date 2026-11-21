/**
 * 참조 구현: lucide-icons/lucide icons/*.svg (ISC License, Copyright (c) Lucide Contributors)
 * 관리자 셸·커맨드 팔레트·허브·대시보드·포스트·클라우드·로그인 전용 Lucide 24×24 원본 벡터 모듈.
 * 공개 피드/상세 번들 및 프로필 전용 소셜 아이콘과 분리해 라우트별 번들 예산을 보존한다.
 */
import React from "react"

export type AdminCoreIconName =
  | "search"
  | "close"
  | "edit"
  | "service"
  | "file"
  | "folder"
  | "cloud"
  | "lock"
  | "log-out"
  | "list"
  | "globe"
  | "spark"
  | "laptop"
  | "camera"
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

type Props = {
  name: AdminCoreIconName
  className?: string
} & React.SVGProps<SVGSVGElement>

const renderAdminIconChildren = (name: AdminCoreIconName): React.ReactNode => {
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
    case "file":
      return (
        <>
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
          <path d="M14 2v5a1 1 0 0 0 1 1h5" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </>
      )
    case "folder":
      return (
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      )
    case "cloud":
      return <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    case "lock":
      return (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      )
    case "log-out":
      return (
        <>
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </>
      )
    case "list":
      return (
        <>
          <path d="M3 5h.01" />
          <path d="M3 12h.01" />
          <path d="M3 19h.01" />
          <path d="M8 5h13" />
          <path d="M8 12h13" />
          <path d="M8 19h13" />
        </>
      )
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </>
      )
    case "spark":
      return (
        <>
          <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
          <path d="M20 2v4" />
          <path d="M22 4h-4" />
          <circle cx="4" cy="20" r="2" />
        </>
      )
    case "laptop":
      return (
        <>
          <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
          <path d="M20.054 15.987H3.946" />
        </>
      )
    case "camera":
      return (
        <>
          <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
          <circle cx="12" cy="13" r="3" />
        </>
      )
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />
    case "chevron-right":
      return <path d="m9 18 6-6-6-6" />
    case "arrow-left":
      return (
        <>
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </>
      )
    case "arrow-right":
      return (
        <>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </>
      )
    case "external-link":
      return (
        <>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </>
      )
    case "plus":
      return (
        <>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </>
      )
    case "refresh":
      return (
        <>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </>
      )
    case "panel-left":
      return (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </>
      )
    case "layout-dashboard":
      return (
        <>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </>
      )
    case "activity":
      return (
        <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
      )
    case "wrench":
      return (
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
      )
    case "settings":
      return (
        <>
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
          <circle cx="12" cy="12" r="3" />
        </>
      )
    case "terminal":
      return (
        <>
          <path d="M12 19h8" />
          <path d="m4 17 6-6-6-6" />
        </>
      )
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      )
    default:
      return null
  }
}

const AdminAppIcon: React.FC<Props> = ({ name, className, ...props }) => {
  const children = renderAdminIconChildren(name)
  if (!children) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export default AdminAppIcon
