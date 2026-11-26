import { apiFetch } from "../client"
import { asOpenApiPath } from "../openapiContract"
import type { ApiEditorPostDto, ApiPostDto } from "./PostApiDtos"
import type { RsData } from "src/types"

const ADM_TEMP_POSTS_PATH = asOpenApiPath("/post/api/v1/adm/posts/temp")
const ADM_TEMP_POST_DELETE_TEMPLATE = asOpenApiPath("/post/api/v1/adm/posts/temp/{id}")
const ADM_SERIES_LIST_PATH = asOpenApiPath("/post/api/v1/adm/posts/series")

export const listAdminTempDrafts = async (signal?: AbortSignal): Promise<ApiPostDto[]> => {
  const rows = await apiFetch<ApiPostDto[]>(ADM_TEMP_POSTS_PATH, { signal })
  return Array.isArray(rows) ? rows : []
}

export const createAdminTempDraft = async (): Promise<RsData<ApiEditorPostDto>> =>
  await apiFetch<RsData<ApiEditorPostDto>>(ADM_TEMP_POSTS_PATH, {
    method: "POST",
  })

export const deleteAdminTempDraft = async (postId: string | number): Promise<RsData<unknown>> => {
  const path = ADM_TEMP_POST_DELETE_TEMPLATE.replace("{id}", encodeURIComponent(String(postId).trim()))
  return await apiFetch<RsData<unknown>>(path, {
    method: "DELETE",
  })
}

export const listAdminSeriesNames = async (signal?: AbortSignal): Promise<string[]> => {
  const rows = await apiFetch<string[]>(ADM_SERIES_LIST_PATH, { signal })
  if (!Array.isArray(rows)) return []
  return rows.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}
