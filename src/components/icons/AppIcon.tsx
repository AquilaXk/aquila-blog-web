import React from "react"

export type IconName =
  | "search"
  | "tag"
  | "bell"
  | "chevron-down"
  | "moon"
  | "sun"
  | "service"
  | "github"
  | "google"
  | "instagram"
  | "mail"
  | "linkedin"
  | "heart"
  | "heart-filled"
  | "reply"
  | "edit"
  | "trash"
  | "copy"
  | "message"
  | "check-circle"
  | "close"
  | "eye"
  | "eye-off"
  | "kakao"
  | "laptop"
  | "spark"
  | "briefcase"
  | "cloud"
  | "camera"
  | "question"
  | "rocket"
  | "globe"
  | "link"
  | "italic"
  | "list"
  | "share"
  | "phone"
  | "file"
  | "folder"
  | "clock"
  | "package"
  | "lock"
  | "log-out"

type Props = {
  name: IconName
  className?: string
} & React.SVGProps<SVGSVGElement>

const FILLED_ICONS = new Set<IconName>(["github", "spark", "kakao", "linkedin", "heart-filled"])

const renderIconChildren = (name: IconName): React.ReactNode => {
  switch (name) {
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </>
      )
    case "tag":
      return (
        <>
          <path d="M20 13.6 10.4 4H4v6.4l9.6 9.6a1.8 1.8 0 0 0 2.6 0l3.8-3.8a1.8 1.8 0 0 0 0-2.6Z" />
          <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
        </>
      )
    case "bell":
      return (
        <>
          <path d="M10.35 20a1.8 1.8 0 0 0 3.3 0" />
          <path d="M5.2 16.2c1.1-1.1 1.95-2.54 1.95-5A4.85 4.85 0 0 1 12 6.35a4.85 4.85 0 0 1 4.85 4.85c0 2.46.85 3.9 1.95 5H5.2Z" />
        </>
      )
    case "chevron-down":
      return <path d="m6 9 6 6 6-6" />
    case "moon":
      return <path d="M19.35 14.15A7.95 7.95 0 1 1 10.05 4.7a6.45 6.45 0 0 0 9.3 9.45Z" />
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.1M12 19.4v2.1M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2.1M19.4 12h2.1M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" />
        </>
      )
    case "service":
      return (
        <>
          <path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z" />
          <path d="M4.5 7.2 12 11.4l7.5-4.2M12 11.4V21" />
        </>
      )
    case "github":
      return <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6 0-.6 0-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.4-2.2-.2-4.6-1.1-4.6-5A3.9 3.9 0 0 1 7 8.3c-.1-.2-.4-1.3.1-2.8 0 0 .8-.3 2.9 1A10 10 0 0 1 12 6.2c.7 0 1.4.1 2 .3 2.1-1.3 2.9-1 2.9-1 .5 1.5.2 2.6.1 2.8a4 4 0 0 1 1 2.8c0 3.8-2.3 4.7-4.6 5 .4.3.8 1 .8 2v2.9c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
    case "google":
      return (
        <>
          <path fill="#4285F4" d="M21.6 12.3c0-.73-.06-1.41-.2-2.08H12v3.95h5.38a4.56 4.56 0 0 1-1.98 2.98v2.59h3.22c1.88-1.73 2.98-4.3 2.98-7.47Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.22-2.59c-.9.6-2.04.97-3.39.97-2.61 0-4.83-1.77-5.62-4.14H3.07v2.67A9.98 9.98 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.38 13.81a5.9 5.9 0 0 1 0-3.62V7.52H3.07a9.97 9.97 0 0 0 0 8.96l3.31-2.67Z" />
          <path fill="#EA4335" d="M12 6.05c1.47 0 2.8.5 3.84 1.48l2.86-2.86C16.95 3.03 14.69 2 12 2A9.98 9.98 0 0 0 3.07 7.52l3.31 2.67C7.17 7.82 9.39 6.05 12 6.05Z" />
        </>
      )
    case "instagram":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </>
      )
    case "mail":
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="m5.5 7.5 6.5 5 6.5-5" />
        </>
      )
    case "message":
      return <path d="M6.5 18.5 4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H6.5Z" />
    case "laptop":
      return (
        <>
          <rect x="4" y="5" width="16" height="10" rx="1.8" />
          <path d="M2.8 18.5h18.4M9 18.5h6" />
        </>
      )
    case "spark":
      return <path d="m12 2.8 1.7 5 5.5.4-4.3 3.3 1.4 5.2-4.3-3-4.3 3 1.4-5.2-4.3-3.3 5.5-.4L12 2.8Zm7.2 13.7.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    case "briefcase":
      return (
        <>
          <rect x="3.5" y="7" width="17" height="11.5" rx="2" />
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7M3.5 11.2h17" />
        </>
      )
    case "cloud":
      return (
        <>
          <path d="M7.2 18.5h9.9a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8-1.6 4.8 4.8 0 0 0 .6 9.6Z" />
          <path d="M8.2 14.4h7.6M10.6 11.8h4" />
        </>
      )
    case "camera":
      return (
        <>
          <path d="M7.5 6.5 9 4.5h6l1.5 2H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h2.5Z" />
          <circle cx="12" cy="12.5" r="3.6" />
        </>
      )
    case "question":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.2a2.5 2.5 0 1 1 4.4 1.6c-.7.7-1.6 1.1-1.6 2.2M12 16.8h.01" />
        </>
      )
    case "rocket":
      return (
        <>
          <path d="M14.6 4.6c2.7 0 4.9 2.2 4.9 4.9 0 4.1-3.6 8-9.5 9.8.5-1.8.9-3.5 1.9-4.9l-3-3c1.4-1 3.1-1.4 4.9-1.9.8-3.7 2.1-4.9.8-4.9Z" />
          <circle cx="15.8" cy="8.3" r="1.1" />
          <path d="m5 14 3 3M4.5 19.5l2.3-5.1" />
        </>
      )
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.8 12h16.4M12 3.5a12.2 12.2 0 0 1 0 17M12 3.5a12.2 12.2 0 0 0 0 17" />
        </>
      )
    case "link":
      return (
        <>
          <path d="M10.2 13.8 8.5 15.5a3.2 3.2 0 1 1-4.5-4.5l2.6-2.6a3.2 3.2 0 0 1 4.5 0" />
          <path d="M13.8 10.2 15.5 8.5a3.2 3.2 0 1 1 4.5 4.5l-2.6 2.6a3.2 3.2 0 0 1-4.5 0" />
          <path d="m9 15 6-6" />
        </>
      )
    case "italic":
      return (
        <>
          <path d="M11 5h7" />
          <path d="M6 19h7" />
          <path d="M13 5 10 19" />
        </>
      )
    case "list":
      return (
        <>
          <circle cx="5.25" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="5.25" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="5.25" cy="17" r="1" fill="currentColor" stroke="none" />
          <path d="M9 7h10M9 12h10M9 17h10" />
        </>
      )
    case "share":
      return (
        <>
          <circle cx="6.5" cy="12.2" r="2.1" />
          <circle cx="17.4" cy="6.4" r="2.1" />
          <circle cx="17.4" cy="17.7" r="2.1" />
          <path d="m8.3 11.3 7.1-3.7M8.3 13.2l7 3.8" />
        </>
      )
    case "phone":
      return <path d="M5 4.8a1.8 1.8 0 0 1 2.4-.7l2.2 1.1a1.8 1.8 0 0 1 .9 2.2l-.7 2.1a1.8 1.8 0 0 0 .4 1.8l2.5 2.5a1.8 1.8 0 0 0 1.8.4l2.1-.7a1.8 1.8 0 0 1 2.2.9l1.1 2.2a1.8 1.8 0 0 1-.7 2.4l-1 .6a4 4 0 0 1-4.1 0 21.3 21.3 0 0 1-7.9-7.9 4 4 0 0 1 0-4.1l.8-1Z" />
    case "file":
      return (
        <>
          <path d="M6.5 3.8h7.2l3.8 3.8v12.6H6.5V3.8Z" />
          <path d="M13.5 4v4h4M9 12h6M9 15.5h6" />
        </>
      )
    case "folder":
      return (
        <>
          <path d="M3.8 7.2h6l1.7 2h8.7v9.6H3.8V7.2Z" />
          <path d="M3.8 9.2h16.4" />
        </>
      )
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8.3" />
          <path d="M12 7.5v5l3.3 2" />
        </>
      )
    case "package":
      return (
        <>
          <path d="M12 3.5 4.5 7.4v9.2L12 20.5l7.5-3.9V7.4L12 3.5Z" />
          <path d="M4.8 7.6 12 11.5l7.2-3.9M12 11.5v8.8" />
        </>
      )
    case "lock":
      return (
        <>
          <rect x="5.5" y="10" width="13" height="9.2" rx="2" />
          <path d="M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10" />
        </>
      )
    case "log-out":
      return (
        <>
          <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" />
          <path d="M13 8.2 16.8 12 13 15.8M16.8 12H9.5" />
        </>
      )
    case "check-circle":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.3 2.2 2.2 4.8-5" />
        </>
      )
    case "close":
      return <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )
    case "eye-off":
      return (
        <>
          <path d="M3.5 3.5 20.5 20.5" />
          <path d="M10.9 6.1c.4-.06.73-.1 1.1-.1 5.7 0 9.5 6 9.5 6a16.3 16.3 0 0 1-3.7 4.1M14.6 14.6A3.7 3.7 0 0 1 9.4 9.4M6.3 17.1A16.3 16.3 0 0 1 2.5 12s1.4-2.2 3.8-4" />
        </>
      )
    case "kakao":
      return <path d="M12 4c-4.94 0-8.95 3.06-8.95 6.82 0 2.41 1.62 4.52 4.07 5.71l-.85 3.09a.4.4 0 0 0 .6.44l3.73-2.47c.46.07.92.1 1.4.1 4.94 0 8.95-3.06 8.95-6.83C20.95 7.06 16.94 4 12 4Z" />
    case "linkedin":
      return <path d="M6.4 8.7a1.7 1.7 0 1 1 0-3.3 1.7 1.7 0 0 1 0 3.3ZM4.9 10h3V19h-3V10Zm4.8 0h2.9v1.3h.1c.4-.8 1.5-1.6 3-1.6 3.2 0 3.8 2.1 3.8 4.9V19h-3v-3.8c0-.9 0-2-1.3-2s-1.5 1-1.5 1.9V19h-3V10Z" />
    case "heart":
      return <path d="M12 20.2 4.9 13.4a4.6 4.6 0 0 1 6.5-6.5L12 7.5l.6-.6a4.6 4.6 0 1 1 6.5 6.5L12 20.2Z" />
    case "heart-filled":
      return <path d="M12 20.7 4.4 13.3a5.1 5.1 0 0 1 7.2-7.2L12 6.5l.4-.4a5.1 5.1 0 0 1 7.2 7.2L12 20.7Z" />
    case "reply":
      return (
        <>
          <path d="m9.5 7.5-4 4 4 4" />
          <path d="M5.5 11.5H14a4.5 4.5 0 0 1 4.5 4.5v.5" />
        </>
      )
    case "edit":
      return (
        <>
          <path d="m4.5 16.8-.8 3.7 3.7-.8L18 9a2.1 2.1 0 1 0-3-3L4.5 16.8Z" />
          <path d="m13.8 7.2 3 3" />
        </>
      )
    case "trash":
      return (
        <>
          <path d="M4.5 7.5h15M9.5 3.8h5l.7 1.7H19v1.6l-.9 11a1.5 1.5 0 0 1-1.5 1.4H7.4a1.5 1.5 0 0 1-1.5-1.4L5 7.1V5.5h3.8l.7-1.7Z" />
          <path d="M10 10.5v5.5M14 10.5v5.5" />
        </>
      )
    case "copy":
      return (
        <>
          <rect x="9" y="8" width="10" height="12" rx="2.2" />
          <path d="M6.8 16H6A2 2 0 0 1 4 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.8" />
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
    name === "google"
      ? {}
      : FILLED_ICONS.has(name)
        ? { fill: "currentColor" }
        : {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: name === "moon" ? "2" : name === "bell" || name === "italic" ? "1.9" : "1.8",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
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
