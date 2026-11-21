/**
 * 참조 구현: lucide-icons/lucide icons/*.svg (ISC License, Copyright (c) Lucide Contributors)
 * 관리자 프로필(/admin/profile) 외부 링크·소셜 카드 편집기 전용 Lucide 24×24 원본 벡터 및 공식 브랜드 마크 모듈.
 */
import React from "react"
import type { IconName } from "src/components/icons/AppIcon"

type Props = {
  name: IconName
  className?: string
} & React.SVGProps<SVGSVGElement>

const FILLED_PROFILE_ICONS = new Set<IconName>(["github", "kakao", "linkedin"])

const renderProfileIconChildren = (name: IconName): React.ReactNode => {
  switch (name) {
    case "service":
      return (
        <>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </>
      )
    case "briefcase":
      return (
        <>
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect width="20" height="14" x="2" y="6" rx="2" />
        </>
      )
    case "laptop":
      return (
        <>
          <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
          <path d="M20.054 15.987H3.946" />
        </>
      )
    case "rocket":
      return (
        <>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
          <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />
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
    case "search":
      return (
        <>
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </>
      )
    case "tag":
      return (
        <>
          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
        </>
      )
    case "camera":
      return (
        <>
          <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
          <circle cx="12" cy="13" r="3" />
        </>
      )
    case "question":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5" />
          <path d="M12 17h.01" />
        </>
      )
    case "github":
      return (
        <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6 0-.6 0-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.4-2.2-.2-4.6-1.1-4.6-5A3.9 3.9 0 0 1 7 8.3c-.1-.2-.4-1.3.1-2.8 0 0 .8-.3 2.9 1A10 10 0 0 1 12 6.2c.7 0 1.4.1 2 .3 2.1-1.3 2.9-1 2.9-1 .5 1.5.2 2.6.1 2.8a4 4 0 0 1 1 2.8c0 3.8-2.3 4.7-4.6 5 .4.3.8 1 .8 2v2.9c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
      )
    case "linkedin":
      return (
        <path d="M6.4 8.7a1.7 1.7 0 1 1 0-3.3 1.7 1.7 0 0 1 0 3.3ZM4.9 10h3V19h-3V10Zm4.8 0h2.9v1.3h.1c.4-.8 1.5-1.6 3-1.6 3.2 0 3.8 2.1 3.8 4.9V19h-3v-3.8c0-.9 0-2-1.3-2s-1.5 1-1.5 1.9V19h-3V10Z" />
      )
    case "mail":
      return (
        <>
          <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
          <rect x="2" y="4" width="20" height="16" rx="2" />
        </>
      )
    case "message":
      return (
        <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
      )
    case "kakao":
      return (
        <path d="M12 4c-4.94 0-8.95 3.06-8.95 6.82 0 2.41 1.62 4.52 4.07 5.71l-.85 3.09a.4.4 0 0 0 .6.44l3.73-2.47c.46.07.92.1 1.4.1 4.94 0 8.95-3.06 8.95-6.83C20.95 7.06 16.94 4 12 4Z" />
      )
    case "instagram":
      return (
        <>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
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
    case "link":
      return (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      )
    case "phone":
      return (
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
      )
    case "bell":
      return (
        <>
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </>
      )
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />
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
    case "close":
      return (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      )
    case "trash":
      return (
        <>
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      )
    default:
      return null
  }
}

const AdminProfileIcon: React.FC<Props> = ({ name, className, ...props }) => {
  const children = renderProfileIconChildren(name)
  if (!children) return null
  const svgDefaults: React.SVGProps<SVGSVGElement> = FILLED_PROFILE_ICONS.has(name)
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

export default AdminProfileIcon
