// 참조 구현: TryGhost/Ghost apps/admin/src/settings/ (MIT) & transloadit/uppy (MIT) — 프로필 영속화·SSR 방어 정규화·이미지 시그니처 선검증
import { apiFetch, getApiBaseUrl } from "src/apis/backend/client"
import type { ProfileCardLinkItem } from "src/constants/profileCardLinks"
import type { ProfileImageSourceSize } from "src/libs/profileImageUpload"
import {
  type AboutProjectBlock,
  type AboutSectionBlock,
  normalizeBlogDesign,
  normalizeLegacyBlogScheme,
  type ProfileWorkspaceContent,
  type ProfileWorkspaceResponse,
} from "src/libs/profileWorkspace"
import { validateCloudFileBeforeUpload } from "./cloudFileSignatureGuard"

export const PROFILE_UNSAVED_CHANGES_MESSAGE = "저장하지 않은 변경 사항이 있습니다. 이 페이지를 떠날까요?"
export const PROFILE_IMAGE_DRAFT_DEFAULT_SOURCE_SIZE: ProfileImageSourceSize = { width: 1, height: 1 }
export const PROFILE_IMAGE_CSRF_PREFLIGHT_HEADERS = { "X-Aquila-CSRF": "1" } as const

const ALLOWED_PROFILE_RASTER_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"])

export type ProfileImageHistoryItem = {
  id: number
  imageUrl: string
  objectKey: string
  contentType: string
  fileSize: number
  status: "TEMP" | "ACTIVE" | "PENDING_DELETE" | "DELETED"
  isCurrent: boolean
  createdAt: string
  modifiedAt: string
}

type ProfileImageHistoryResponse = {
  images?: ProfileImageHistoryItem[]
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "")

const normalizeDraftAboutSectionsSafe = (raw: unknown): AboutSectionBlock[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is Partial<AboutSectionBlock> => Boolean(entry && typeof entry === "object"))
    .map((section, index) => ({
      id: asString(section.id).trim() || `section-${index + 1}`,
      title: asString(section.title),
      items: Array.isArray(section.items) ? section.items.map((item) => asString(item)) : [],
      dividerBefore: Boolean(section.dividerBefore),
    }))
}

const normalizeDraftAboutProjectsSafe = (raw: unknown): AboutProjectBlock[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is Partial<AboutProjectBlock> => Boolean(entry && typeof entry === "object"))
    .map((project, index) => ({
      id: asString(project.id).trim() || `project-${index + 1}`,
      name: asString(project.name),
      summary: asString(project.summary),
      role: asString(project.role),
      href: asString(project.href),
      linkLabel: asString(project.linkLabel),
    }))
}

const normalizeDraftLinksSafe = (raw: unknown, fallbackIcon: ProfileCardLinkItem["icon"]): ProfileCardLinkItem[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is Partial<ProfileCardLinkItem> => Boolean(entry && typeof entry === "object"))
    .map((item) => ({
      icon: item.icon || fallbackIcon,
      label: asString(item.label),
      href: asString(item.href),
    }))
}

export const normalizeProfileWorkspaceDraftSafe = (
  content?: Partial<ProfileWorkspaceContent> | null
): ProfileWorkspaceContent => {
  const src = content && typeof content === "object" ? content : {}
  return {
    profileImageUrl: asString(src.profileImageUrl),
    profileRole: asString(src.profileRole),
    profileBio: asString(src.profileBio),
    aboutHeadline: asString(src.aboutHeadline),
    aboutRole: asString(src.aboutRole),
    aboutBio: asString(src.aboutBio),
    aboutSections: normalizeDraftAboutSectionsSafe(src.aboutSections ?? []),
    aboutProjectSectionTitle: asString(src.aboutProjectSectionTitle),
    aboutProjects: normalizeDraftAboutProjectsSafe(src.aboutProjects ?? []),
    blogTitle: asString(src.blogTitle),
    homeIntroTitle: asString(src.homeIntroTitle),
    homeIntroDescription: asString(src.homeIntroDescription),
    blogDesign: normalizeBlogDesign(src.blogDesign),
    legacyBlogScheme: normalizeLegacyBlogScheme(src.legacyBlogScheme),
    serviceLinks: normalizeDraftLinksSafe(src.serviceLinks ?? [], "service"),
    contactLinks: normalizeDraftLinksSafe(src.contactLinks ?? [], "mail"),
  }
}

export const normalizeProfileWorkspaceResponseSafe = (
  workspace: Partial<ProfileWorkspaceResponse> | null | undefined
): ProfileWorkspaceResponse | null => {
  if (!workspace || typeof workspace !== "object") return null
  if (!workspace.draft && !workspace.published) return null
  const draft = normalizeProfileWorkspaceDraftSafe(workspace.draft ?? workspace.published)
  const published = normalizeProfileWorkspaceDraftSafe(workspace.published ?? workspace.draft)
  return {
    draft,
    published,
    lastDraftSavedAt: workspace.lastDraftSavedAt ?? null,
    lastPublishedAt: workspace.lastPublishedAt ?? null,
    dirtyFromPublished: Boolean(workspace.dirtyFromPublished),
  }
}

export const validateProfileImageFileBeforeDecode = async (file: File): Promise<void> => {
  const dotIndex = file.name.lastIndexOf(".")
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : ""
  const lowerMime = (file.type || "").toLowerCase()
  if (ext === "svg" || lowerMime.includes("svg")) {
    throw new Error("프로필 이미지는 JPG/PNG/GIF/WebP 래스터 형식만 지원합니다.")
  }
  if (ext && !ALLOWED_PROFILE_RASTER_EXTENSIONS.has(ext)) {
    throw new Error("지원하지 않는 프로필 이미지 확장자입니다.")
  }
  const signatureCheck = await validateCloudFileBeforeUpload(file)
  if (!signatureCheck.ok) {
    throw new Error(signatureCheck.reason)
  }
}

export const readImageSourceSizeFromFile = async (file: File): Promise<ProfileImageSourceSize> => {
  await validateProfileImageFileBeforeDecode(file)

  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      if (width <= 0 || height <= 0) {
        reject(new Error("이미지 해상도를 확인할 수 없습니다."))
        return
      }
      resolve({ width, height })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("이미지 정보를 읽을 수 없습니다."))
    }
    image.src = objectUrl
  })
}

export const parseResponseErrorBody = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => "")
  if (!text) return ""

  try {
    const parsed = JSON.parse(text) as { resultCode?: string; msg?: string }
    const msg = parsed.msg?.trim()
    if (!msg) return text
    return parsed.resultCode ? `${msg} (${parsed.resultCode})` : msg
  } catch {
    return text
  }
}

export const revalidatePublicBlogAppearance = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
    return response.ok
  } catch {
    return false
  }
}

export const requestProfileImageUpload = async (memberId: number, file: File): Promise<Response> => {
  const formData = new FormData()
  formData.append("file", file, file.name)
  return await fetch(`${getApiBaseUrl()}/member/api/v1/adm/members/${memberId}/profileImageFile`, {
    method: "POST",
    headers: PROFILE_IMAGE_CSRF_PREFLIGHT_HEADERS,
    credentials: "include",
    body: formData,
  })
}

export const listPreviousProfileImages = async (memberId: number): Promise<ProfileImageHistoryItem[]> => {
  const response = await apiFetch<ProfileImageHistoryResponse>(
    `/member/api/v1/adm/members/${memberId}/profileImageFiles`
  )
  return (response.images || []).filter((image) => image.id > 0 && image.imageUrl.trim().length > 0)
}

export const deletePreviousProfileImage = async (memberId: number, fileId: number): Promise<void> => {
  await apiFetch(`/member/api/v1/adm/members/${memberId}/profileImageFiles/${fileId}`, {
    method: "DELETE",
  })
}
