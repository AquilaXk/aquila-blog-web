import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { compareCategoryValues, normalizeCategoryValue, splitCategoryDisplay } from "src/libs/utils"
import { dedupeStrings } from "./editorStudioMetaModel"
import {
  CATEGORY_CATALOG_STORAGE_KEY,
  TAG_CATALOG_STORAGE_KEY,
  persistCatalog,
  readStoredCatalog,
} from "./editorStudioStorageModel"

type UseEditorStudioMetaCatalogParams = {
  postCategory: string
  setPostCategory: Dispatch<SetStateAction<string>>
  setPostTags: Dispatch<SetStateAction<string[]>>
  setTagDraft: Dispatch<SetStateAction<string>>
}

export const resolveCanonicalCategoryFromCatalog = (
  rawCategory: string,
  catalog: ReadonlyArray<string>
): string => {
  const trimmed = rawCategory.trim()
  if (!trimmed) return ""
  if (/^[a-z0-9-]+::/i.test(trimmed)) return normalizeCategoryValue(trimmed)
  const normalized = normalizeCategoryValue(trimmed)
  if (!normalized) return ""
  const targetLabel = splitCategoryDisplay(normalized).label
  const matched = catalog.find((entry) => splitCategoryDisplay(entry).label === targetLabel)
  return matched ?? normalized
}

export const useEditorStudioMetaCatalog = ({
  postCategory,
  setPostCategory,
  setPostTags,
  setTagDraft,
}: UseEditorStudioMetaCatalogParams) => {
  const [customTagCatalog, setCustomTagCatalog] = useState<string[]>([])
  const [customCategoryCatalog, setCustomCategoryCatalog] = useState<string[]>([])
  const [hasHydratedCatalog, setHasHydratedCatalog] = useState(false)

  useEffect(() => {
    setCustomTagCatalog(readStoredCatalog(TAG_CATALOG_STORAGE_KEY).sort((a, b) => a.localeCompare(b)))
    setCustomCategoryCatalog(
      dedupeStrings(
        readStoredCatalog(CATEGORY_CATALOG_STORAGE_KEY)
          .filter((item) => item.trim().length > 0)
          .map(normalizeCategoryValue)
      ).sort(compareCategoryValues)
    )
    setHasHydratedCatalog(true)
  }, [])

  useEffect(() => {
    if (!hasHydratedCatalog) return
    persistCatalog(TAG_CATALOG_STORAGE_KEY, customTagCatalog)
  }, [customTagCatalog, hasHydratedCatalog])

  useEffect(() => {
    if (!hasHydratedCatalog) return
    persistCatalog(CATEGORY_CATALOG_STORAGE_KEY, customCategoryCatalog)
  }, [customCategoryCatalog, hasHydratedCatalog])

  const addTagsToPost = useCallback((values: string[]) => {
    const normalizedTags = dedupeStrings(values.map((value) => value.trim()).filter(Boolean))
    if (normalizedTags.length === 0) return []

    setPostTags((prev) => dedupeStrings([...prev, ...normalizedTags]))
    setCustomTagCatalog((prev) => {
      const base = hasHydratedCatalog
        ? prev
        : dedupeStrings([...readStoredCatalog(TAG_CATALOG_STORAGE_KEY), ...prev])
      const next = dedupeStrings([...base, ...normalizedTags]).sort((a, b) => a.localeCompare(b))
      persistCatalog(TAG_CATALOG_STORAGE_KEY, next)
      return next
    })

    return normalizedTags
  }, [hasHydratedCatalog, setPostTags])

  const addTagToPost = useCallback((value: string) => {
    const added = addTagsToPost([value])
    if (added.length > 0) setTagDraft("")
  }, [addTagsToPost, setTagDraft])

  const removeTagFromPost = useCallback((value: string) => {
    setPostTags((prev) => prev.filter((tag) => tag !== value))
  }, [setPostTags])

  const handlePostCategoryChange = useCallback((value: string) => {
    setPostCategory(value)
  }, [setPostCategory])

  const commitPostCategory = useCallback((): string => {
    if (!postCategory.trim()) {
      setPostCategory("")
      return ""
    }
    const storedBase = hasHydratedCatalog
      ? customCategoryCatalog
      : dedupeStrings([
          ...readStoredCatalog(CATEGORY_CATALOG_STORAGE_KEY)
            .filter((item) => item.trim().length > 0)
            .map(normalizeCategoryValue),
          ...customCategoryCatalog,
        ])
    const category = resolveCanonicalCategoryFromCatalog(postCategory, storedBase)
    setPostCategory(category)
    if (!category) return ""
    setCustomCategoryCatalog((current) => {
      const base = hasHydratedCatalog ? current : storedBase
      if (base.includes(category)) return base
      const next = dedupeStrings([...base, category]).sort(compareCategoryValues)
      persistCatalog(CATEGORY_CATALOG_STORAGE_KEY, next)
      return next
    })
    return category
  }, [customCategoryCatalog, hasHydratedCatalog, postCategory, setPostCategory])

  return {
    addTagsToPost,
    addTagToPost,
    commitPostCategory,
    customCategoryCatalog,
    customTagCatalog,
    handlePostCategoryChange,
    removeTagFromPost,
  }
}
