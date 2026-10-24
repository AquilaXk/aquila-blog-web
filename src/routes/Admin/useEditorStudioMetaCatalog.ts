import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { compareCategoryValues, normalizeCategoryValue } from "src/libs/utils"
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

export const useEditorStudioMetaCatalog = ({
  postCategory,
  setPostCategory,
  setPostTags,
  setTagDraft,
}: UseEditorStudioMetaCatalogParams) => {
  const [customTagCatalog, setCustomTagCatalog] = useState<string[]>([])
  const [customCategoryCatalog, setCustomCategoryCatalog] = useState<string[]>([])

  useEffect(() => {
    setCustomTagCatalog(readStoredCatalog(TAG_CATALOG_STORAGE_KEY))
    setCustomCategoryCatalog(
      dedupeStrings(readStoredCatalog(CATEGORY_CATALOG_STORAGE_KEY).map(normalizeCategoryValue)).sort(
        compareCategoryValues
      )
    )
  }, [])

  useEffect(() => {
    persistCatalog(TAG_CATALOG_STORAGE_KEY, customTagCatalog)
  }, [customTagCatalog])

  useEffect(() => {
    persistCatalog(CATEGORY_CATALOG_STORAGE_KEY, customCategoryCatalog)
  }, [customCategoryCatalog])

  const addTagsToPost = useCallback((values: string[]) => {
    const normalizedTags = dedupeStrings(values.map((value) => value.trim()).filter(Boolean))
    if (normalizedTags.length === 0) return []

    setPostTags((prev) => dedupeStrings([...prev, ...normalizedTags]))
    setCustomTagCatalog((prev) => dedupeStrings([...prev, ...normalizedTags]).sort((a, b) => a.localeCompare(b)))

    return normalizedTags
  }, [setPostTags])

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

  const commitPostCategory = useCallback(() => {
    if (!postCategory.trim()) {
      setPostCategory("")
      return
    }
    const category = normalizeCategoryValue(postCategory)
    setPostCategory(category)
    if (!category) return
    setCustomCategoryCatalog((current) => {
      if (current.includes(category)) return current
      return dedupeStrings([...current, category]).sort(compareCategoryValues)
    })
  }, [postCategory, setPostCategory])

  return {
    addTagsToPost,
    addTagToPost,
    commitPostCategory,
    customCategoryCatalog,
    handlePostCategoryChange,
    removeTagFromPost,
  }
}
