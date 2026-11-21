import type React from "react"

type IconProps = {
  size?: number
  strokeWidth?: number
  className?: string
}

const baseSvgProps = (size = 20, strokeWidth = 1.85) => ({
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
})

export const CheckGlyph: React.FC<IconProps> = ({ size = 16, strokeWidth = 2.2, className }) => (
  <svg {...baseSvgProps(size, strokeWidth)} className={className}>
    <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
)

export const DownloadGlyph: React.FC<IconProps> = ({ size = 16, strokeWidth = 2, className }) => (
  <svg {...baseSvgProps(size, strokeWidth)} className={className}>
    <line x1="12" y1="3" x2="12" y2="15" />
    <polyline points="7.5 10.5 12 15 16.5 10.5" />
    <polyline points="4 16 4 20 20 20 20 16" />
  </svg>
)

export const CopyGlyph: React.FC<IconProps> = ({ size = 16, strokeWidth = 1.9, className }) => (
  <svg {...baseSvgProps(size, strokeWidth)} className={className}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <polyline points="5.5 15.5 3.5 15.5 3.5 3.5 15.5 3.5 15.5 5.5" />
  </svg>
)

export const AppleOsGlyph: React.FC<IconProps> = ({ size = 17, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 14 17"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <path d="M11.66 9.03c-.02-1.99 1.62-2.95 1.7-3-.93-1.36-2.37-1.54-2.88-1.57-1.21-.12-2.39.72-3.01.72-.63 0-1.58-.7-2.61-.68-1.33.02-2.57.78-3.25 1.97-1.4 2.43-.36 6.02.99 7.99.67.97 1.46 2.05 2.5 2.01 1.01-.04 1.4-.65 2.62-.65 1.22 0 1.57.65 2.63.63 1.09-.02 1.77-.98 2.43-1.95.77-1.12 1.08-2.21 1.1-2.27-.02-.01-2.2-.85-2.22-3.2ZM9.7 3.12c.55-.67.92-1.59.82-2.52-.79.03-1.76.53-2.33 1.2-.51.59-.96 1.54-.84 2.44.89.07 1.8-.45 2.35-1.12Z" />
  </svg>
)

export const WindowsOsGlyph: React.FC<IconProps> = ({ size = 17, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 22 22"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <polygon points="1.5 4.2 10 3 10 10.3 1.5 10.3" />
    <polygon points="11.3 2.8 20.5 1.5 20.5 10.3 11.3 10.3" />
    <polygon points="1.5 11.7 10 11.7 10 19 1.5 17.8" />
    <polygon points="11.3 11.7 20.5 11.7 20.5 20.5 11.3 19.2" />
  </svg>
)

export const LinuxOsGlyph: React.FC<IconProps> = ({ size = 17, strokeWidth = 1.85, className }) => (
  <svg {...baseSvgProps(size, strokeWidth)} className={className}>
    <ellipse cx="12" cy="12" rx="6" ry="8.5" />
    <circle cx="10" cy="8.5" r="0.8" />
    <circle cx="14" cy="8.5" r="0.8" />
    <polygon points="10.5 11 13.5 11 12 13" />
    <line x1="8" y1="20.5" x2="10.5" y2="20.5" />
    <line x1="13.5" y1="20.5" x2="16" y2="20.5" />
  </svg>
)

export const SparklesGlyph: React.FC<IconProps> = ({ size = 14, strokeWidth = 1.9, className }) => (
  <svg {...baseSvgProps(size, strokeWidth)} className={className}>
    <polygon points="12 2.5 14.3 9.7 21.5 12 14.3 14.3 12 21.5 9.7 14.3 2.5 12 9.7 9.7" />
    <line x1="19" y1="3" x2="19" y2="6.5" />
    <line x1="17.25" y1="4.75" x2="20.75" y2="4.75" />
  </svg>
)

export type CompanyIconName =
  | "accessibility"
  | "local-engine"
  | "sandbox-convert"
  | "resilience"
  | "operations"
  | "quality"
  | "train-front"
  | "file-text"
  | "table-2"
  | "presentation"
  | "file-check-2"
  | "terminal"
  | "cpu"
  | "layers"
  | "git-branch"
  | "lock"
  | "globe"
  | "database"

export const CompanyVectorIcon: React.FC<IconProps & { name: CompanyIconName }> = ({
  name,
  size = 20,
  strokeWidth = 1.85,
  className,
}) => {
  const props = { ...baseSvgProps(size, strokeWidth), className }
  switch (name) {
    case "accessibility":
      return (
        <svg {...props}>
          <circle cx="12" cy="5.2" r="2" />
          <line x1="5.5" y1="9.5" x2="18.5" y2="9.5" />
          <line x1="12" y1="9.5" x2="12" y2="14.5" />
          <line x1="12" y1="14.5" x2="8.5" y2="20.5" />
          <line x1="12" y1="14.5" x2="15.5" y2="20.5" />
        </svg>
      )
    case "local-engine":
    case "cpu":
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="0.75" />
          <line x1="9.5" y1="2.5" x2="9.5" y2="6" />
          <line x1="14.5" y1="2.5" x2="14.5" y2="6" />
          <line x1="9.5" y1="18" x2="9.5" y2="21.5" />
          <line x1="14.5" y1="18" x2="14.5" y2="21.5" />
          <line x1="2.5" y1="9.5" x2="6" y2="9.5" />
          <line x1="2.5" y1="14.5" x2="6" y2="14.5" />
          <line x1="18" y1="9.5" x2="21.5" y2="9.5" />
          <line x1="18" y1="14.5" x2="21.5" y2="14.5" />
        </svg>
      )
    case "sandbox-convert":
      return (
        <svg {...props}>
          <line x1="4" y1="8" x2="20" y2="8" />
          <polyline points="15.5 4 20 8 15.5 12" />
          <line x1="20" y1="16" x2="4" y2="16" />
          <polyline points="8.5 12 4 16 8.5 20" />
        </svg>
      )
    case "resilience":
      return (
        <svg {...props}>
          <polygon points="12 2.5 19.5 5.5 19.5 12 12 21.5 4.5 12 4.5 5.5" />
          <polyline points="8.5 12 11 14.5 15.5 9.5" />
        </svg>
      )
    case "operations":
      return (
        <svg {...props}>
          <rect x="3" y="3.5" width="18" height="7" rx="1.5" />
          <rect x="3" y="13.5" width="18" height="7" rx="1.5" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
          <line x1="11" y1="7" x2="17" y2="7" />
          <line x1="7" y1="17" x2="7.01" y2="17" />
          <line x1="11" y1="17" x2="17" y2="17" />
        </svg>
      )
    case "quality":
      return (
        <svg {...props}>
          <polygon points="9 3 15 3 21 9 21 15 15 21 9 21 3 15 3 9" />
          <polyline points="8.5 12.2 11 14.8 15.8 9.5" />
        </svg>
      )
    case "train-front":
      return (
        <svg {...props}>
          <rect x="5" y="4" width="14" height="14" rx="4" />
          <line x1="5" y1="11.5" x2="19" y2="11.5" />
          <line x1="8.5" y1="14.8" x2="8.51" y2="14.8" />
          <line x1="15.5" y1="14.8" x2="15.51" y2="14.8" />
          <line x1="8" y1="18" x2="5.5" y2="21.5" />
          <line x1="16" y1="18" x2="18.5" y2="21.5" />
        </svg>
      )
    case "file-text":
      return (
        <svg {...props}>
          <polygon points="6 2.5 14.5 2.5 18.5 6.5 18.5 21.5 6 21.5" />
          <polyline points="14.5 2.5 14.5 6.5 18.5 6.5" />
          <line x1="9" y1="11" x2="15.5" y2="11" />
          <line x1="9" y1="14.5" x2="15.5" y2="14.5" />
          <line x1="9" y1="18" x2="13" y2="18" />
        </svg>
      )
    case "table-2":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="9.5" x2="15" y2="20" />
        </svg>
      )
    case "presentation":
      return (
        <svg {...props}>
          <line x1="2.5" y1="4" x2="21.5" y2="4" />
          <rect x="4" y="4" width="16" height="11" rx="1.5" />
          <polyline points="8 20.5 12 15 16 20.5" />
        </svg>
      )
    case "file-check-2":
      return (
        <svg {...props}>
          <polygon points="5.5 2.5 14 2.5 18.5 7 18.5 21.5 5.5 21.5" />
          <polyline points="14 2.5 14 7 18.5 7" />
          <polyline points="8.5 14.2 11 16.8 15.5 11.8" />
        </svg>
      )
    case "terminal":
      return (
        <svg {...props}>
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <polyline points="7 9.5 10.5 12.5 7 15.5" />
          <line x1="12.5" y1="15.5" x2="17" y2="15.5" />
        </svg>
      )
    case "layers":
      return (
        <svg {...props}>
          <polygon points="12 3 21 8 12 13 3 8" />
          <polyline points="3 12.5 12 17.5 21 12.5" />
          <polyline points="3 17 12 22 21 17" />
        </svg>
      )
    case "git-branch":
      return (
        <svg {...props}>
          <circle cx="6.5" cy="6" r="2.2" />
          <circle cx="17.5" cy="6.5" r="2.2" />
          <circle cx="6.5" cy="18" r="2.2" />
          <line x1="6.5" y1="8.2" x2="6.5" y2="15.8" />
          <polyline points="17.5 8.7 17.5 12 12 15.5 6.5 15.5" />
        </svg>
      )
    case "lock":
      return (
        <svg {...props}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
      )
    case "database":
      return (
        <svg {...props}>
          <ellipse cx="12" cy="6" rx="8.5" ry="2.8" />
          <path d="M3.5 6v12a8.5 2.8 0 0 0 17 0V6" />
          <path d="M3.5 12a8.5 2.8 0 0 0 17 0" />
        </svg>
      )
    case "globe":
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9.5" />
          <ellipse cx="12" cy="12" rx="4.2" ry="9.5" />
          <line x1="2.5" y1="12" x2="21.5" y2="12" />
        </svg>
      )
  }
}
