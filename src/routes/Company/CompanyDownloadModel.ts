/**
 * 참조 구현:
 * - launch-ui/launch-ui (components/sections/items/default.tsx 데이터 모델, MIT License)
 */
import type { CompanyIconName } from "src/routes/Company/CompanyIcons"

export const EASYOFFICE_REPO_URL = "https://github.com/AquilaXk/easyoffice"
export const EASYOFFICE_RELEASES_URL = "https://github.com/AquilaXk/easyoffice/releases"
export const EASYOFFICE_LATEST_RELEASE_URL = "https://github.com/AquilaXk/easyoffice/releases/latest"
export const EASYOFFICE_CHECKSUM_URL =
  "https://github.com/AquilaXk/easyoffice/releases/latest/download/SHA256SUMS.txt"

export type EasyOfficeBinaryAssetName =
  | "EasyOffice-macos-universal.dmg"
  | "EasyOffice-windows-x64-setup.exe"
  | "EasyOffice-linux-x64.deb"
  | "EasyOffice-linux-arm64.deb"
  | "EasyOffice-linux-x64.rpm"
  | "EasyOffice-linux-x64.AppImage"

export type EasyOfficeAssetName = EasyOfficeBinaryAssetName | "SHA256SUMS.txt"

export type EasyOfficeReleaseInfo = {
  version: string
  tag: string
  publishedDate: string
  releaseUrl: string
  checksums: Readonly<Record<string, string>>
}

export type PlatformAssetChecksum = {
  assetName: EasyOfficeBinaryAssetName
  sha256: string
}

export type DownloadOsKey = "macos" | "windows" | "linux"

export type DownloadAction = {
  assetName: EasyOfficeAssetName
  label: string
  href: string
  variant: "primary" | "secondary"
}

export type DownloadSnippet = {
  id: string
  os: DownloadOsKey
  title: string
  command: string
}

export type DownloadOsPlatform = {
  os: DownloadOsKey
  label: string
  actions: readonly DownloadAction[]
  requirements: string
  installNote: string
  snippets: readonly DownloadSnippet[]
}

export type StudioModuleCard = {
  id: string
  icon: CompanyIconName
  title: string
  badge: string
  description: string
  actionLabel: string
  actionHref: string
}

export const normalizeDownloadOs = (raw: string | string[] | undefined): DownloadOsKey => {
  const value = (Array.isArray(raw) ? raw[0] : raw || "").trim().toLowerCase()
  if (value === "win" || value === "windows") return "windows"
  if (value === "linux" || value === "ubuntu" || value === "debian" || value === "fedora") {
    return "linux"
  }
  if (value === "mac" || value === "macos" || value === "darwin") return "macos"
  return "macos"
}

export const detectClientDownloadOs = (userAgent: string, platform = ""): DownloadOsKey => {
  const ua = `${userAgent} ${platform}`.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("linux") || ua.includes("x11")) return "linux"
  return "macos"
}

export const EASYOFFICE_OS_PLATFORMS: readonly DownloadOsPlatform[] = [
  {
    os: "macos",
    label: "macOS",
    actions: [
      {
        assetName: "EasyOffice-macos-universal.dmg",
        label: "macOS 유니버설 다운로드 (.dmg)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-macos-universal.dmg",
        variant: "primary",
      },
      {
        assetName: "SHA256SUMS.txt",
        label: "SHA-256 체크섬 (SHA256SUMS.txt)",
        href: EASYOFFICE_CHECKSUM_URL,
        variant: "secondary",
      },
    ],
    requirements:
      "macOS 11 (Big Sur) 이상 · Quick Look 미리보기 확장은 macOS 12 (Monterey) 이상 (Apple Silicon 및 Intel 유니버설)",
    installNote:
      "Apple Developer ID 공증 전 빌드이므로 처음 실행 시 Finder에서 우클릭 → 열기 또는 아래 격리 속성 제거 명령을 1회 실행합니다.",
    snippets: [
      {
        id: "macos-verify-quarantine",
        os: "macos",
        title: "macOS (체크섬 대조 및 Gatekeeper 허용)",
        command:
          "shasum -a 256 -c SHA256SUMS.txt --ignore-missing && xattr -dr com.apple.quarantine /Applications/EasyOffice.app",
      },
    ],
  },
  {
    os: "windows",
    label: "Windows",
    actions: [
      {
        assetName: "EasyOffice-windows-x64-setup.exe",
        label: "Windows x64 설치 프로그램 다운로드 (.exe)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-windows-x64-setup.exe",
        variant: "primary",
      },
      {
        assetName: "SHA256SUMS.txt",
        label: "SHA-256 체크섬 (SHA256SUMS.txt)",
        href: EASYOFFICE_CHECKSUM_URL,
        variant: "secondary",
      },
    ],
    requirements: "Windows 10 (64비트, x64) 이상 · Microsoft Edge WebView2 런타임",
    installNote:
      "서명 전 빌드이므로 Windows SmartScreen 안내가 표시되면 추가 정보 → 실행을 선택하고 필요 시 아래 명령으로 SHA-256 해시를 확인합니다.",
    snippets: [
      {
        id: "windows-powershell",
        os: "windows",
        title: "Windows PowerShell",
        command: "Get-FileHash .\\EasyOffice-windows-x64-setup.exe -Algorithm SHA256",
      },
      {
        id: "windows-cmd",
        os: "windows",
        title: "Windows CMD",
        command: "certutil -hashfile EasyOffice-windows-x64-setup.exe SHA256",
      },
    ],
  },
  {
    os: "linux",
    label: "Linux",
    actions: [
      {
        assetName: "EasyOffice-linux-x64.deb",
        label: "Linux x64 다운로드 (.deb · Ubuntu/Debian)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-linux-x64.deb",
        variant: "primary",
      },
      {
        assetName: "EasyOffice-linux-arm64.deb",
        label: "Linux ARM64 다운로드 (.deb)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-linux-arm64.deb",
        variant: "secondary",
      },
      {
        assetName: "EasyOffice-linux-x64.rpm",
        label: "Linux x64 (.rpm · Fedora)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-linux-x64.rpm",
        variant: "secondary",
      },
      {
        assetName: "EasyOffice-linux-x64.AppImage",
        label: "Linux x64 (AppImage)",
        href: "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-linux-x64.AppImage",
        variant: "secondary",
      },
    ],
    requirements:
      "glibc >= 2.35, WebKitGTK 4.1 (Ubuntu 22.04+, Debian 12+, Fedora 38+ 권장)",
    installNote:
      "한글 입력기와 WebKitGTK 런타임 안정성을 위해 배포판 네이티브 패키지(.deb / .rpm) 설치를 우선 권장합니다.",
    snippets: [
      {
        id: "linux-apt",
        os: "linux",
        title: "Ubuntu · Debian (apt)",
        command: "sudo apt install ./EasyOffice-linux-x64.deb",
      },
      {
        id: "linux-dnf",
        os: "linux",
        title: "Fedora · openSUSE (dnf)",
        command: "sudo dnf install ./EasyOffice-linux-x64.rpm",
      },
    ],
  },
] as const

export const EASYOFFICE_OS_MAP: Readonly<Record<DownloadOsKey, DownloadOsPlatform>> = {
  macos: EASYOFFICE_OS_PLATFORMS[0],
  windows: EASYOFFICE_OS_PLATFORMS[1],
  linux: EASYOFFICE_OS_PLATFORMS[2],
}

const RELEASE_TAG_RE = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const SHA256_HEX_RE = /^[0-9a-fA-F]{64}$/

export const resolveEasyOfficeAssetUrl = (
  assetName: EasyOfficeAssetName,
  release: EasyOfficeReleaseInfo | null | undefined
): string => {
  const tag = release?.tag
  if (typeof tag === "string" && RELEASE_TAG_RE.test(tag)) {
    return `${EASYOFFICE_REPO_URL}/releases/download/${tag}/${assetName}`
  }
  return `${EASYOFFICE_REPO_URL}/releases/latest/download/${assetName}`
}

export const resolvePlatformChecksums = (
  os: DownloadOsKey,
  release: EasyOfficeReleaseInfo | null | undefined
): PlatformAssetChecksum[] => {
  if (!release?.checksums) return []
  const platform = EASYOFFICE_OS_MAP[os]
  const out: PlatformAssetChecksum[] = []

  for (let i = 0; i < platform.actions.length; i += 1) {
    const assetName = platform.actions[i]!.assetName
    if (assetName === "SHA256SUMS.txt") continue
    const digest = release.checksums[assetName]
    if (typeof digest === "string" && SHA256_HEX_RE.test(digest)) {
      out.push({ assetName, sha256: digest.toLowerCase() })
    }
  }

  return out
}

export const EASYOFFICE_STUDIO_MODULES: readonly StudioModuleCard[] = [
  {
    id: "doc-hwp",
    icon: "file-text",
    title: "문서 & 한글 스튜디오",
    badge: "HWP · HWPX · DOCX",
    description:
      "HWP·HWPX·HWT·DOCX·ODT·RTF·Markdown 문서를 다단·머리글·각주·변경 추적까지 보존하며 로컬에서 편집합니다.",
    actionLabel: "릴리스 노트",
    actionHref: `${EASYOFFICE_REPO_URL}/blob/main/CHANGELOG.md`,
  },
  {
    id: "sheet",
    icon: "table-2",
    title: "스프레드시트 스튜디오",
    badge: "313종 함수 · XLSX",
    description:
      "313종 내장 함수, 피벗 테이블, 슬라이서, 차트 5종, 조건부 서식과 구조적 참조를 XLSX·ODS·CSV·TSV로 왕복합니다.",
    actionLabel: "릴리스 노트",
    actionHref: `${EASYOFFICE_REPO_URL}/blob/main/CHANGELOG.md`,
  },
  {
    id: "slide",
    icon: "presentation",
    title: "프레젠테이션 스튜디오",
    badge: "PPTX · ODP · PDF",
    description:
      "좌표 기반 슬라이드 캔버스에서 글상자·도형·표·차트와 마스터 레이아웃, 발표자 보기를 PPTX·ODP로 편집합니다.",
    actionLabel: "릴리스 노트",
    actionHref: `${EASYOFFICE_REPO_URL}/blob/main/CHANGELOG.md`,
  },
  {
    id: "pdf",
    icon: "file-check-2",
    title: "PDF 스튜디오",
    badge: "주석 · 양식 · 레이어",
    description:
      "FreeText·형광펜·밑줄 주석, 쪽 편집, 북마크·양식 필드와 숨긴 레이어, XMP 메타데이터를 원본 객체 그대로 저장합니다.",
    actionLabel: "릴리스 노트",
    actionHref: `${EASYOFFICE_REPO_URL}/blob/main/CHANGELOG.md`,
  },
  {
    id: "base-board",
    icon: "database",
    title: "BASE & BOARD",
    badge: ".eobase · .eoboard",
    description:
      "관계형 표·수식·칸반·일정 보기를 제공하는 BASE와 도형·연결선·차트를 놓는 무한 캔버스 BOARD를 내장합니다.",
    actionLabel: "포맷 명세",
    actionHref: `${EASYOFFICE_REPO_URL}/blob/main/docs/format-support.md`,
  },
  {
    id: "convert-copilot",
    icon: "sandbox-convert",
    title: "로컬 변환기 & 코파일럿",
    badge: "20종 변환 · BYO AI",
    description:
      "20종 문서 포맷 간 오프라인 일괄 변환을 실행하고, 사용자가 등록한 AI 모델 서버에 연결해 편집 보조를 받습니다.",
    actionLabel: "저장소 보기",
    actionHref: EASYOFFICE_REPO_URL,
  },
] as const
