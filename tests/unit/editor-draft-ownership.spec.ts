import { expect, test } from "@playwright/test"
import {
  localDraftStorageKey,
  localDraftStorageKeyForDocument,
  captureLocalDraftCleanup,
  getLocalDraftDocumentId,
} from "../../src/routes/Admin/editorStudioStorageModel"

test("document-owned draft keys isolate the same post across browser documents", () => {
  const source = { kind: "post", postId: "42" } as const
  const first = localDraftStorageKeyForDocument(source, "first-document")
  const second = localDraftStorageKeyForDocument(source, "second-document")

  expect(first).toBe("admin.editor.localDraft.post.42.first-document.v3")
  expect(second).toBe("admin.editor.localDraft.post.42.second-document.v3")
  expect(first).not.toBe(second)
  expect(localDraftStorageKey(source)).toBe("admin.editor.localDraft.post.42.v3")
})

test("document-owned create keys isolate duplicated browser documents", () => {
  const source = { kind: "create" } as const

  expect(localDraftStorageKeyForDocument(source, "first-document"))
    .toBe("admin.editor.localDraft.create.first-document.v3")
  expect(localDraftStorageKeyForDocument(source, "second-document"))
    .toBe("admin.editor.localDraft.create.second-document.v3")
})

test("save cleanup preserves another document and a newer owned revision", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key) },
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } })
  try {
    const source = { kind: "post", postId: "42" } as const
    const ownKey = localDraftStorageKeyForDocument(source, getLocalDraftDocumentId())
    const otherKey = localDraftStorageKeyForDocument(source, "other-document")
    values.set(ownKey, "submitted revision")
    values.set(otherKey, "other manuscript")
    const cleanup = captureLocalDraftCleanup(source)
    values.set(ownKey, "newer revision")
    expect(cleanup()).toBe(false)
    expect(values.get(ownKey)).toBe("newer revision")
    expect(values.get(otherKey)).toBe("other manuscript")
    expect(captureLocalDraftCleanup(source)()).toBe(true)
    expect(values.has(ownKey)).toBe(false)
    expect(values.get(otherKey)).toBe("other manuscript")
    const absentCleanup = captureLocalDraftCleanup(source)
    values.set(ownKey, "created while saving")
    expect(absentCleanup()).toBe(false)
    expect(values.get(ownKey)).toBe("created while saving")
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
