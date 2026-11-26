// 참조 구현: strapi/strapi (MIT), transloadit/uppy (MIT), supabase/supabase (Apache-2.0) — 클라우드 스토리지 API·서명 공유 링크
import type { components } from "@shared/contracts"
import type { RsData } from "src/types"
import { ApiError, apiFetch, getApiRequestUrl } from "./client"
import {
  CLOUD_SYNC_UPLOAD_MAX_BYTES,
  type CloudFile,
  type CloudFileDto,
  type CloudMediaKind,
  type CloudUploadOptions,
  isResumableVideoUploadFile,
  normalizeCloudFile,
  uploadCloudVideoFileResumable,
} from "./cloudVideoUpload"
import { createUploadSpeedEstimator, sendCloudUploadXhr } from "./cloudXhrTransport"

export { ApiError }
export {
  CLOUD_SYNC_UPLOAD_MAX_BYTES,
  clearStoredVideoUploadSessionId,
  isDefinitiveStaleVideoUploadSessionError,
  isExplicitUploadAbort,
  isResumableVideoUploadFile,
  readStoredVideoUploadSessionId,
  storeVideoUploadSessionId,
  type CloudFile,
  type CloudFileDto,
  type CloudMediaKind,
  type CloudUploadOptions,
  type CloudUploadProgress,
  type CloudVideoUploadSession,
} from "./cloudVideoUpload"

type CloudFileListResBody = components["schemas"]["CloudFileListResBody"]
type RsDataCloudFileDto = components["schemas"]["RsDataCloudFileDto"]
type RsDataVoid = components["schemas"]["RsDataVoid"]
type CloudExternalPlaybackTokenDto = components["schemas"]["CloudExternalPlaybackTokenDto"]
type RsDataCloudExternalPlaybackTokenDto = components["schemas"]["RsDataCloudExternalPlaybackTokenDto"]
export type CloudExternalTokenPurpose = NonNullable<
  components["schemas"]["CloudExternalPlaybackTokenSummaryDto"]["purpose"]
>
export type CloudExternalPlaybackTokenItem = components["schemas"]["CloudExternalPlaybackTokenSummaryDto"]
export type CloudFileFacetsResBody = components["schemas"]["CloudFileFacetsResBody"]
export type CloudBulkDeleteResultDto = components["schemas"]["BulkDeleteCloudFilesResBody"]
export type CloudPromotePostAssetResultDto = components["schemas"]["PromoteCloudPostAssetResBody"]
type RevokeTokensResBody = components["schemas"]["RevokeExternalPlaybackTokensResBody"]

export type CloudShareLinkTtlSeconds = 3600 | 21600 | 86400 | 604800

const CLOUD_UPLOAD_TIMEOUT_MS = 10 * 60_000 + 30_000

export type CloudFileListParams = {
  folderPath?: string
  keyword?: string
  mediaKind?: CloudMediaKind
}

export type CloudExternalPlaybackToken = {
  fileId: number
  token: string
  expiresAt: string
  contentPath: string
  contentUrl: string
}

const appendQuery = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    const normalized = value?.trim()
    if (normalized) query.set(key, normalized)
  })
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

export const getCloudFileContentUrl = (fileId: number) =>
  getApiRequestUrl(`/system/api/v1/adm/cloud/files/${fileId}/content`)

export const getCloudFileThumbnailUrl = (fileId: number) =>
  getApiRequestUrl(`/system/api/v1/adm/cloud/files/${fileId}/thumbnail`)

export const getCloudFileDownloadUrl = (fileId: number): string =>
  getApiRequestUrl(`/system/api/v1/adm/cloud/files/${fileId}/content?download=true`)

export const resolveCloudPublicShareUrl = (contentPath: string): string => {
  const requestPath = getApiRequestUrl(contentPath)
  if (typeof window === "undefined") return requestPath
  try {
    return new URL(requestPath, window.location.origin).toString()
  } catch {
    return requestPath
  }
}

const normalizeCloudExternalPlaybackToken = (
  fileId: number,
  token: CloudExternalPlaybackTokenDto | undefined
): CloudExternalPlaybackToken => {
  const normalizedFileId = Number(token?.fileId || fileId)
  const rawToken = token?.token?.trim() || ""
  const expiresAt = token?.expiresAt?.trim() || ""
  const contentPath = token?.contentPath?.trim() || ""
  if (!normalizedFileId || !rawToken || !expiresAt || !contentPath) {
    throw new Error("공유 또는 재생 링크를 생성하지 못했습니다.")
  }

  return {
    fileId: normalizedFileId,
    token: rawToken,
    expiresAt,
    contentPath,
    contentUrl: resolveCloudPublicShareUrl(contentPath),
  }
}

export const issueCloudExternalPlaybackToken = async (
  fileId: number,
  ttlSeconds?: CloudShareLinkTtlSeconds
): Promise<CloudExternalPlaybackToken> => {
  const response = await apiFetch<RsDataCloudExternalPlaybackTokenDto>(
    `/system/api/v1/adm/cloud/files/${fileId}/external-playback-token`,
    {
      method: "POST",
      body: ttlSeconds ? JSON.stringify({ ttlSeconds }) : undefined,
      timeoutMs: 30_000,
    }
  )
  return normalizeCloudExternalPlaybackToken(fileId, response.data)
}

export const issueCloudShareLink = async (
  fileId: number,
  ttlSeconds: CloudShareLinkTtlSeconds
): Promise<CloudExternalPlaybackToken> => {
  const response = await apiFetch<RsDataCloudExternalPlaybackTokenDto>(
    `/system/api/v1/adm/cloud/files/${fileId}/share-links`,
    {
      method: "POST",
      body: JSON.stringify({ ttlSeconds }),
      timeoutMs: 30_000,
    }
  )
  return normalizeCloudExternalPlaybackToken(fileId, response.data)
}

export const listCloudShareLinks = async (
  fileId: number,
  signal?: AbortSignal
): Promise<CloudExternalPlaybackTokenItem[]> => {
  const response = await apiFetch<components["schemas"]["CloudExternalPlaybackTokenListResBody"]>(
    `/system/api/v1/adm/cloud/files/${fileId}/share-links`,
    { signal }
  )
  return response.tokens || []
}

export const revokeCloudShareLink = async (fileId: number, tokenId: number): Promise<void> => {
  await apiFetch<RsDataVoid>(`/system/api/v1/adm/cloud/files/${fileId}/share-links/${tokenId}`, {
    method: "DELETE",
  })
}

export const revokeAllCloudShareLinks = async (fileId: number): Promise<{ revokedCount: number }> => {
  const response = await apiFetch<RsData<RevokeTokensResBody | undefined>>(
    `/system/api/v1/adm/cloud/files/${fileId}/share-links`,
    { method: "DELETE" }
  )
  return { revokedCount: Number(response.data?.revokedCount || 0) }
}

export const listCloudFiles = async ({
  folderPath = "",
  keyword = "",
  mediaKind,
}: CloudFileListParams = {}): Promise<CloudFile[]> => {
  const response = await apiFetch<CloudFileListResBody>(
    appendQuery("/system/api/v1/adm/cloud/files", {
      folderPath,
      kw: keyword,
      mediaKind,
    })
  )
  return (response.files || []).map(normalizeCloudFile).filter((file) => file.id > 0)
}

export const uploadCloudFile = async (
  file: File,
  folderPath = "",
  signal?: AbortSignal,
  options: CloudUploadOptions = {}
): Promise<CloudFile> => {
  if (isResumableVideoUploadFile(file)) {
    return uploadCloudVideoFileResumable(file, folderPath, signal, options)
  }

  const formData = new FormData()
  formData.append("clientFilename", file.name)
  formData.append("file", file)
  const targetPath = appendQuery("/system/api/v1/adm/cloud/files", { folderPath })

  if (typeof XMLHttpRequest !== "undefined") {
    const estimator = createUploadSpeedEstimator(Math.max(1, file.size))
    options.onProgress?.({
      progress: 1,
      message: "업로드 시작",
      loadedBytes: 0,
      totalBytes: file.size,
      speedBps: 0,
      etaSeconds: null,
    })
    const response = await sendCloudUploadXhr<RsDataCloudFileDto>({
      path: targetPath,
      method: "POST",
      body: formData,
      signal,
      timeoutMs: CLOUD_UPLOAD_TIMEOUT_MS,
      onProgress: (loadedBytes, rawTotalBytes) => {
        const effectiveTotal = rawTotalBytes > 0 ? rawTotalBytes : Math.max(1, file.size)
        const metrics = estimator(loadedBytes)
        const percent = Math.min(98, Math.max(2, Math.round((loadedBytes / effectiveTotal) * 98)))
        options.onProgress?.({
          progress: percent,
          message: loadedBytes >= effectiveTotal ? "서버 처리 중" : `${percent}% 전송 중`,
          loadedBytes: metrics.loadedBytes,
          totalBytes: metrics.totalBytes,
          speedBps: metrics.speedBps,
          etaSeconds: metrics.etaSeconds,
        })
      },
    })
    return normalizeCloudFile(response.data || {})
  }

  const response = await apiFetch<RsDataCloudFileDto>(targetPath, {
    method: "POST",
    body: formData,
    signal,
    timeoutMs: CLOUD_UPLOAD_TIMEOUT_MS,
  })
  return normalizeCloudFile(response.data || {})
}

export const updateCloudFile = async (
  fileId: number,
  payload: { originalFilename?: string; folderPath?: string }
): Promise<CloudFile> => {
  const response = await apiFetch<RsDataCloudFileDto | CloudFileDto>(
    `/system/api/v1/adm/cloud/files/${fileId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  )
  const fileData =
    response && typeof response === "object" && "data" in response && response.data
      ? response.data
      : (response as CloudFileDto | undefined)
  if (!fileData) throw new Error("클라우드 파일 수정 응답이 비어 있습니다.")
  return normalizeCloudFile(fileData)
}

export const deleteCloudFile = async (fileId: number) =>
  apiFetch<RsDataVoid>(`/system/api/v1/adm/cloud/files/${fileId}`, {
    method: "DELETE",
  })

export type CloudFileFacets = {
  allCount: number
  allBytes: number
  photoCount: number
  photoBytes: number
  videoCount: number
  videoBytes: number
  documentCount: number
  documentBytes: number
  folders: string[]
}

export const getCloudFileFacets = async (signal?: AbortSignal): Promise<CloudFileFacets> => {
  const res = await apiFetch<CloudFileFacetsResBody>("/system/api/v1/adm/cloud/files/facets", { signal })
  return {
    allCount: Number(res.allCount || 0),
    allBytes: Number(res.allBytes || 0),
    photoCount: Number(res.photoCount || 0),
    photoBytes: Number(res.photoBytes || 0),
    videoCount: Number(res.videoCount || 0),
    videoBytes: Number(res.videoBytes || 0),
    documentCount: Number(res.documentCount || 0),
    documentBytes: Number(res.documentBytes || 0),
    folders: Array.isArray(res.folders)
      ? res.folders.filter((folder): folder is string => typeof folder === "string" && folder.trim().length > 0)
      : [],
  }
}

export type CloudBulkDeleteResult = {
  deletedIds: number[]
  deletedCount: number
}

export const bulkDeleteCloudFiles = async (ids: number[]): Promise<CloudBulkDeleteResult> => {
  const response = await apiFetch<RsData<CloudBulkDeleteResultDto | undefined>>(
    "/system/api/v1/adm/cloud/files/bulk-delete",
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    }
  )
  return {
    deletedIds: (response.data?.deletedIds || []).map(Number),
    deletedCount: Number(response.data?.deletedCount || 0),
  }
}

export type CloudPromotePostAssetResult = {
  fileId: number
  key: string
  url: string
  markdown: string
}

export const promoteCloudFileToPostAsset = async (
  fileId: number
): Promise<CloudPromotePostAssetResult> => {
  const response = await apiFetch<RsData<CloudPromotePostAssetResultDto | undefined>>(
    `/system/api/v1/adm/cloud/files/${fileId}/promote-post-asset`,
    { method: "POST" }
  )
  const d = response.data
  if (!d?.url) throw new Error("클라우드 사진을 게시글 이미지로 불러오지 못했습니다.")
  return {
    fileId: Number(d.fileId || fileId),
    key: d.key || "",
    url: d.url,
    markdown: d.markdown || "",
  }
}

export const listCloudExternalPlaybackTokens = async (
  fileId: number,
  signal?: AbortSignal
): Promise<CloudExternalPlaybackTokenItem[]> => {
  const response = await apiFetch<components["schemas"]["CloudExternalPlaybackTokenListResBody"]>(
    `/system/api/v1/adm/cloud/files/${fileId}/external-playback-tokens`,
    { signal }
  )
  return response.tokens || []
}

export const revokeCloudExternalPlaybackToken = async (
  fileId: number,
  tokenId: number
): Promise<void> => {
  await apiFetch<RsDataVoid>(
    `/system/api/v1/adm/cloud/files/${fileId}/external-playback-tokens/${tokenId}`,
    { method: "DELETE" }
  )
}

export const revokeAllCloudExternalPlaybackTokens = async (
  fileId: number
): Promise<{ revokedCount: number }> => {
  const response = await apiFetch<RsData<RevokeTokensResBody | undefined>>(
    `/system/api/v1/adm/cloud/files/${fileId}/external-playback-tokens`,
    { method: "DELETE" }
  )
  return { revokedCount: Number(response.data?.revokedCount || 0) }
}
