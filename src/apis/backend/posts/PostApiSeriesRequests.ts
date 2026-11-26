import type { components } from "@shared/contracts"
import { apiFetch } from "../client"
import { buildPostSeriesPath, recordRuntimeEndpoint } from "./PostApiRequestModel"

type PublicPostSeriesResBody = components["schemas"]["PublicPostSeriesResBody"]

export type PublicSeriesPostItem = {
  id: string
  title: string
  seriesOrder: number | null
  createdAt?: string
}

export type PublicPostSeriesResponse = {
  seriesName: string | null
  items: PublicSeriesPostItem[]
}

export const getPostSeries = async (
  postId: string | number,
  signal?: AbortSignal
): Promise<PublicPostSeriesResponse> => {
  const normalizedId = String(postId).trim()
  if (!normalizedId) return { seriesName: null, items: [] }
  const endpoint = buildPostSeriesPath(normalizedId)
  recordRuntimeEndpoint(endpoint, "page")
  const response = await apiFetch<PublicPostSeriesResBody>(endpoint, { signal })
  const seriesName =
    typeof response?.seriesName === "string" && response.seriesName.trim()
      ? response.seriesName.trim()
      : null
  const rawItems = Array.isArray(response?.items) ? response.items : []
  const items: PublicSeriesPostItem[] = []
  for (const item of rawItems) {
    const rawId = item?.id
    const title = typeof item?.title === "string" ? item.title.trim() : ""
    if (typeof rawId !== "number" || !Number.isInteger(rawId) || rawId <= 0 || !title) continue
    const seriesOrder =
      typeof item.seriesOrder === "number" && Number.isInteger(item.seriesOrder) && item.seriesOrder >= 1
        ? item.seriesOrder
        : null
    items.push({
      id: String(rawId),
      title,
      seriesOrder,
      ...(typeof item.createdAt === "string" && item.createdAt.trim() ? { createdAt: item.createdAt.trim() } : {}),
    })
  }
  return { seriesName, items }
}
