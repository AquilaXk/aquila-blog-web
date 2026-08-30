import { Buffer } from "node:buffer"
import type { Page, Route } from "./helpers/authoringPlaywright"
import { expect, test } from "./helpers/authoringPlaywright"

const localDraftStorageKey = "admin.editor.localDraft.create.v3"
const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A"
const undoShortcut = process.platform === "darwin" ? "Meta+Z" : "Control+Z"
const redoShortcut = process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z"
const saveShortcut = process.platform === "darwin" ? "Meta+S" : "Control+S"
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
)
const adminMember = {
  id: 1,
  username: "qa-admin",
  nickname: "aquila",
  isAdmin: true,
}
const liveMarkdown = [
  "# Live writing",
  "",
  "Paragraph with **bold** and [link](https://example.test).",
  "",
  "- [ ] task",
  "- [x] done",
  "",
  "> quoted note",
  "",
  "```ts",
  "const value = 1",
  "```",
].join("\n")

const fulfillJson = async (route: Route, data: unknown) => {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) })
}

const routeAuthenticatedEditor = async (
  page: Page,
  markdown = liveMarkdown,
  title = "Live writing test",
  seedLocalDraft = true
) => {
  await page.route("**/member/api/v1/auth/me", async (route) => fulfillJson(route, adminMember))
  await page.route("**/member/api/v1/members/adminProfile", async (route) => {
    await fulfillJson(route, adminMember)
  })
  await page.route("**/post/api/v1/posts/tags", async (route) => fulfillJson(route, []))
  await page.route("**/post/api/v1/adm/posts/990", async (route) => {
    await fulfillJson(route, {
      id: 990,
      title: "임시글",
      content: "",
      summary: "",
      summarySource: "NONE",
      published: false,
      listed: false,
      tempDraft: true,
      version: 1,
    })
  })
  await page.route("**/post/api/v1/posts/temp", async (route) => {
    await fulfillJson(route, {
      resultCode: "200-1",
      msg: "temp draft",
      data: {
        id: 990,
        title: "임시글",
        content: "",
        summary: "",
        summarySource: "NONE",
        published: false,
        listed: false,
        tempDraft: true,
      },
    })
  })
  if (!seedLocalDraft) return

  await page.addInitScript(
    ({ storageKey, content, draftTitle }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          title: draftTitle,
          content,
          summary: "Live writing summary",
          summarySource: "MANUAL",
          summaryIntent: { kind: "manual", summary: "Live writing summary" },
          thumbnailUrl: "",
          thumbnailFocusX: 50,
          thumbnailFocusY: 50,
          thumbnailZoom: 1,
          tags: ["markdown"],
          category: "",
          visibility: "PUBLIC_UNLISTED",
          savedAt: new Date().toISOString(),
          source: { kind: "create" },
        })
      )
    },
    { storageKey: localDraftStorageKey, content: markdown, draftTitle: title }
  )
}

const routeEditorPost = async (page: Page, postId: number, markdown: string) => {
  const post = {
    id: postId,
    title: "Existing post",
    content: markdown,
    summary: "Existing summary",
    summarySource: "MANUAL",
    summaryIntent: { kind: "manual", summary: "Existing summary" },
    published: false,
    listed: false,
    tempDraft: false,
    version: 1,
  }
  await page.route(`**/post/api/v1/adm/posts/${postId}`, async (route) => fulfillJson(route, post))
  await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
    await fulfillJson(route, { content: markdown, contentHtml: null })
  })
}

const editorContent = (page: Page) => page.getByTestId("markdown-editor-content")

const visibleEditorLines = (page: Page) =>
  editorContent(page).locator(".cm-line").allTextContents()

const readMarkdown = async (page: Page) => {
  const editor = editorContent(page)
  await editor.focus()
  await editor.press(selectAllShortcut)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return (await visibleEditorLines(page)).join("\n")
}

const fillMarkdown = async (page: Page, markdown: string) => {
  await editorContent(page).fill(markdown)
  await expect.poll(() => readMarkdown(page)).toBe(markdown)
}

const selectMarkdownRange = async (page: Page, from: number, to: number) => {
  const markdown = await readMarkdown(page)
  const editor = editorContent(page)
  await editor.focus()
  await editor.press(selectAllShortcut)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await editor.evaluate((element, rangeOffsets) => {
    const lines = Array.from(element.querySelectorAll<HTMLElement>(".cm-line"))
    const locate = (documentOffset: number) => {
      let remaining = documentOffset
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex]
        const lineLength = line.textContent?.length ?? 0
        if (remaining <= lineLength) {
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
          let textNode = walker.nextNode() as Text | null
          let textOffset = remaining
          while (textNode) {
            if (textOffset <= textNode.data.length) return { node: textNode, offset: textOffset }
            textOffset -= textNode.data.length
            textNode = walker.nextNode() as Text | null
          }
          return { node: line, offset: line.childNodes.length }
        }
        remaining -= lineLength
        if (lineIndex < lines.length - 1) remaining -= 1
      }
      const lastLine = lines.at(-1) ?? element
      return { node: lastLine, offset: lastLine.childNodes.length }
    }

    const start = locate(rangeOffsets.from)
    const end = locate(rangeOffsets.to)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    const selection = window.getSelection()
    if (!selection) throw new Error("document selection is unavailable")
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))
  }, { from, to })
  await expect.poll(() => editor.evaluate(() => window.getSelection()?.toString() ?? "")).toBe(
    markdown.slice(from, to)
  )
}

const selectMarkdownRangeWithoutAssertion = async (page: Page, from: number, to: number) => {
  const editor = editorContent(page)
  await editor.focus()
  await editor.press(selectAllShortcut)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await editor.evaluate((element, rangeOffsets) => {
    const lines = Array.from(element.querySelectorAll<HTMLElement>(".cm-line"))
    const locate = (documentOffset: number) => {
      let remaining = documentOffset
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex]
        const lineLength = line.textContent?.length ?? 0
        if (remaining <= lineLength) {
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
          let textNode = walker.nextNode() as Text | null
          let textOffset = remaining
          while (textNode) {
            if (textOffset <= textNode.data.length) return { node: textNode, offset: textOffset }
            textOffset -= textNode.data.length
            textNode = walker.nextNode() as Text | null
          }
          return { node: line, offset: line.childNodes.length }
        }
        remaining -= lineLength
        if (lineIndex < lines.length - 1) remaining -= 1
      }
      const lastLine = lines.at(-1) ?? element
      return { node: lastLine, offset: lastLine.childNodes.length }
    }
    const start = locate(rangeOffsets.from)
    const end = locate(rangeOffsets.to)
    const selection = window.getSelection()
    if (!selection) throw new Error("document selection is unavailable")
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))
  }, { from, to })
}

test.describe("live Markdown writing surface", () => {
  test("new and existing editors mount one accessible document surface", async ({ page }) => {
    await routeAuthenticatedEditor(page)
    await page.goto("/admin/editor/new?source=local-draft")

    await expect(page.getByTestId("markdown-editor-live-surface")).toBeVisible()
    await expect(editorContent(page)).toHaveAttribute("contenteditable", "true")
    await expect(page.getByRole("textbox", { name: "Markdown 본문" })).toHaveCount(1)
    await expect(page.getByRole("tab", { name: /^(Write|Preview|Split)$/ })).toHaveCount(0)
    await expect(page.getByTestId("markdown-editor-preview-pane")).toHaveCount(0)
    await expect(page.getByTestId("markdown-editor-write-pane")).toHaveCount(0)
    await expect(page.locator(".cm-live-task-checkbox")).toHaveCount(2)
    await expect(page.locator(".cm-live-quote-marker")).toHaveCount(1)
    await expect(
      editorContent(page).locator(".cm-line", { hasText: "const value = 1" }).locator(".cm-live-fenced-code")
    ).toHaveCount(1)
    expect(await readMarkdown(page)).toBe(liveMarkdown)

    await routeEditorPost(page, 770, liveMarkdown)
    await page.goto("/admin/editor/770")
    await expect(page.locator("#post-title")).toHaveValue("Existing post")
    await expect(page.getByTestId("markdown-editor-live-surface")).toBeVisible()
    expect(await readMarkdown(page)).toBe(liveMarkdown)
  })

  test("selection reveals source for the active block and formats inactive blocks in place", async ({ page }) => {
    const markdown = "# Heading\n\nParagraph with **bold** text."
    await routeAuthenticatedEditor(page, markdown)
    await page.goto("/admin/editor/new?source=local-draft")

    const headingStart = markdown.indexOf("Heading")
    await selectMarkdownRangeWithoutAssertion(page, headingStart, headingStart)
    await expect.poll(() => visibleEditorLines(page)).toEqual([
      "# Heading",
      "",
      "Paragraph with bold text.",
    ])
    await expect(page.locator(".cm-live-strong")).toHaveCount(1)

    const boldStart = markdown.indexOf("bold")
    await selectMarkdownRange(page, boldStart, boldStart + "bold".length)
    await expect.poll(() => visibleEditorLines(page)).toEqual([
      "Heading",
      "",
      "Paragraph with **bold** text.",
    ])
    await expect(page.locator(".cm-live-heading")).toHaveCount(1)
  })

  test("outline navigation targets the single surface and preserves heading labels", async ({ page }) => {
    const title = "목차 이동"
    const markdown = ["## **시작하며**", "", "본문", "", "#### `핵심` 포인트"].join("\n")
    await page.setViewportSize({ width: 1440, height: 900 })
    await routeAuthenticatedEditor(page, markdown, title)
    await page.goto("/admin/editor/new?source=local-draft")

    const outline = page.getByLabel("문서 목차")
    await expect(outline.getByRole("button", { name: "시작하며" })).toBeVisible()
    await expect(outline.getByRole("button", { name: "핵심 포인트" })).toBeVisible()
    await outline.getByRole("button", { name: "핵심 포인트" }).click()
    await expect(editorContent(page)).toBeFocused()
    await expect.poll(() => editorContent(page).evaluate(() => window.getSelection()?.toString() ?? ""))
      .toBe("#### `핵심` 포인트")
  })

  test("dark editor focus and native mouse selection stay on the live surface", async ({ page }) => {
    const markdown = ["# Drag Selection", "", "마우스 드래그로 이 문장을 선택합니다."].join("\n")
    await routeAuthenticatedEditor(page, markdown)
    await page.goto("/admin/editor/new?source=local-draft")

    const surface = page.getByTestId("markdown-editor-live-surface")
    const editor = surface.locator(".cm-editor")
    const colors = await editor.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return { backgroundColor: style.backgroundColor, color: style.color }
    })
    expect(colors.backgroundColor).toBe("rgb(15, 23, 40)")
    expect(colors.color).toBe("rgb(217, 228, 247)")

    const targetLine = editorContent(page).locator(".cm-line").nth(2)
    const box = await targetLine.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    await page.mouse.move(box.x + 3, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + Math.min(box.width - 3, 260), box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()

    await expect(editorContent(page)).toBeFocused()
    const selectedText = await editorContent(page).evaluate(() => window.getSelection()?.toString() ?? "")
    expect(selectedText.length).toBeGreaterThan(0)
    expect("마우스 드래그로 이 문장을 선택합니다.").toContain(selectedText)
  })

  test("composition keeps source visible without creating a second document", async ({ page }) => {
    await routeAuthenticatedEditor(page)
    await page.goto("/admin/editor/new?source=local-draft")
    await selectMarkdownRangeWithoutAssertion(page, liveMarkdown.indexOf("Paragraph"), liveMarkdown.indexOf("Paragraph"))

    await editorContent(page).evaluate((element) => {
      element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "ㅎ" }))
    })
    await expect.poll(() => visibleEditorLines(page)).toEqual(liveMarkdown.split("\n"))
    await editorContent(page).evaluate((element) => {
      element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "한" }))
    })
    await expect(page.getByTestId("markdown-editor-content")).toHaveCount(1)
  })

  test("toolbar mutations, undo, redo, and find/replace share CodeMirror history", async ({ page }) => {
    await routeAuthenticatedEditor(page, "hello")
    await page.goto("/admin/editor/new?source=local-draft")
    await selectMarkdownRange(page, 0, 5)
    await page.getByRole("button", { name: /^굵게/ }).click()
    await expect.poll(() => readMarkdown(page)).toBe("**hello**")

    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("hello")
    await editorContent(page).press(redoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("**hello**")

    await fillMarkdown(page, "Cat cat cat")
    await page.getByRole("button", { name: "찾기 및 바꾸기" }).click()
    await page.getByLabel("찾을 내용").fill("cat")
    await page.getByLabel("바꿀 내용").fill("dog")
    await page.getByRole("button", { name: "모두 바꾸기" }).click()
    await expect.poll(() => readMarkdown(page)).toBe("dog dog dog")
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("Cat cat cat")
  })

  test("table and line commands keep their document selection and shared history", async ({ page }) => {
    const table = ["| A | B |", "| --- | --- |", "| one | two |"].join("\n")
    await routeAuthenticatedEditor(page, table)
    await page.goto("/admin/editor/new?source=local-draft")

    const oneOffset = table.indexOf("one")
    await selectMarkdownRange(page, oneOffset, oneOffset)
    const commandMenu = page.getByRole("combobox", { name: "명령 메뉴", exact: true })
    await expect(commandMenu.getByRole("option", { name: "표 행 추가", exact: true })).toBeEnabled()
    await commandMenu.selectOption("table.add-row")
    expect((await readMarkdown(page)).split("\n").filter((line) => line.startsWith("|")).length).toBe(4)

    const lines = ["first", "second", "third"].join("\n")
    await fillMarkdown(page, lines)
    const selectionStart = lines.indexOf("eco")
    await selectMarkdownRange(page, selectionStart, selectionStart + 3)
    await editorContent(page).press("Alt+ArrowDown")
    await expect.poll(() => readMarkdown(page)).toBe(["first", "third", "second"].join("\n"))
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe(lines)
  })

  test("paired input preserves a selected range and remains undoable", async ({ page }) => {
    await routeAuthenticatedEditor(page, "word")
    await page.goto("/admin/editor/new?source=local-draft")

    await selectMarkdownRange(page, 0, 4)
    await editorContent(page).press("[")
    await expect.poll(() => readMarkdown(page)).toBe("[word]")
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("word")
  })

  test("safe HTML paste preserves content and rejects executable input", async ({ page }) => {
    const source = "prefix target suffix"
    await routeAuthenticatedEditor(page, source)
    await page.goto("/admin/editor/new?source=local-draft")
    const start = source.indexOf("target")
    await selectMarkdownRange(page, start, start + "target".length)

    const prevented = await editorContent(page).evaluate((element) => {
      const clipboard = new DataTransfer()
      clipboard.setData("text/html", '<strong>safe</strong><a href="javascript:alert(1)"> link</a>')
      clipboard.setData("text/plain", "plain fallback")
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(true)
    await expect.poll(() => readMarkdown(page)).toContain("**safe**")
    const markdown = await readMarkdown(page)
    expect(markdown).not.toContain("javascript:")
    expect(markdown).not.toContain("plain fallback")
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe(source)

    await selectMarkdownRange(page, 0, 6)
    await editorContent(page).evaluate((element) => {
      const clipboard = new DataTransfer()
      clipboard.setData("text/html", "<script>window.__editorPasteExecuted = true</script>")
      clipboard.setData("text/plain", "ignored")
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }))
    })
    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toContainText(
      "붙여넣을 수 있는 안전한 HTML 내용이 없습니다."
    )
    expect(await page.evaluate(() => Boolean((window as { __editorPasteExecuted?: boolean }).__editorPasteExecuted))).toBe(false)
  })

  test("image and file uploads insert at the active document selection", async ({ page }) => {
    const source = "alpha\nomega"
    await routeAuthenticatedEditor(page, source)
    await page.route("**/post/api/v1/posts/images", async (route) => {
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "uploaded",
        data: {
          key: "posts/body-image.png",
          url: "http://127.0.0.1:3000/post/api/v1/images/posts/body-image.png",
        },
      })
    })
    await page.route("**/post/api/v1/posts/files", async (route) => {
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "uploaded",
        data: {
          key: "post-files/report.pdf",
          name: "report.pdf",
          url: "https://cdn.example.test/post-files/report.pdf",
        },
      })
    })
    await page.goto("/admin/editor/new?source=local-draft")
    await selectMarkdownRangeWithoutAssertion(page, source.indexOf("omega"), source.indexOf("omega"))

    await page.getByTestId("markdown-editor").locator("input[type='file'][accept='image/*']").setInputFiles({
      name: "body.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    })
    await expect.poll(() => readMarkdown(page)).toContain(
      "![body.png](http://127.0.0.1:3000/post/api/v1/images/posts/body-image.png)"
    )

    await selectMarkdownRangeWithoutAssertion(page, source.indexOf("omega"), source.indexOf("omega"))
    await page.getByTestId("markdown-editor").locator("input[type='file']:not([accept])").setInputFiles({
      name: "report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 attachment"),
    })
    await expect.poll(() => readMarkdown(page)).toContain(
      "[report.pdf](https://cdn.example.test/post-files/report.pdf)"
    )
    const result = await readMarkdown(page)
    expect(result.indexOf("report.pdf")).toBeLessThan(result.indexOf("omega"))
    expect(result.indexOf("body.png")).toBeLessThan(result.indexOf("omega"))
  })

  test("oversized attachments fail before the upload boundary", async ({ page }) => {
    await routeAuthenticatedEditor(page, "body")
    let uploadCalled = false
    await page.route("**/post/api/v1/posts/files", async (route) => {
      uploadCalled = true
      await route.fulfill({ status: 500, body: "unexpected upload" })
    })
    await page.goto("/admin/editor/new?source=local-draft")

    await page.getByTestId("markdown-editor").locator("input[type='file']:not([accept])").setInputFiles({
      name: "too-large.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
    })

    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toHaveText(
      "첨부 파일은 10MB 이하여야 합니다."
    )
    expect(uploadCalled).toBe(false)
  })

  test("local draft autosave, explicit save, and reload keep the controlled Markdown value", async ({ page }) => {
    const title = "저장 계약"
    const content = "# 저장\n\n본문을 유지합니다."
    await routeAuthenticatedEditor(page, "", title, false)
    await page.goto("/admin/editor/new?source=local-draft")
    await page.locator("#post-title").fill(title)
    await fillMarkdown(page, content)
    await editorContent(page).press(saveShortcut)

    await expect.poll(() => page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const draft = JSON.parse(raw) as { title: string; content: string }
      return { title: draft.title, content: draft.content }
    }, localDraftStorageKey)).toEqual({ title, content })

    await page.goto("/admin/editor/new?source=local-draft")
    await expect(page.locator("#post-title")).toHaveValue(title)
    await expect.poll(() => readMarkdown(page)).toBe(content)
  })

  test("whitespace-only summaries autosave as an empty draft and survive reload", async ({ page }) => {
    const title = "공백 요약 초안"
    const content = "공백 요약도 본문은 보존해야 합니다."
    await routeAuthenticatedEditor(page, "", title, false)
    await page.goto("/admin/editor/new?source=local-draft")
    await page.locator("#post-title").fill(title)
    await fillMarkdown(page, content)
    await page.getByLabel("Summary").fill("수동 요약")
    await expect.poll(() => page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const draft = JSON.parse(raw) as { summary: string; summarySource: string }
      return { summary: draft.summary, summarySource: draft.summarySource }
    }, localDraftStorageKey)).toEqual({ summary: "수동 요약", summarySource: "MANUAL" })

    await page.getByLabel("Summary").fill("   ")
    await expect.poll(() => page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const draft = JSON.parse(raw) as {
        content: string
        summary: string
        summarySource: string
        summaryIntent: { kind: string }
      }
      return {
        content: draft.content,
        summary: draft.summary,
        summarySource: draft.summarySource,
        intentKind: draft.summaryIntent.kind,
      }
    }, localDraftStorageKey)).toEqual({
      content,
      summary: "",
      summarySource: "NONE",
      intentKind: "auto",
    })

    await page.goto("/admin/editor/new?source=local-draft")
    await expect.poll(() => readMarkdown(page)).toBe(content)
    await expect(page.getByLabel("Summary")).toHaveValue("")
  })

  test("publish workflow remains available from the unified editor", async ({ page }) => {
    await routeAuthenticatedEditor(page)
    await page.goto("/admin/editor/new?source=local-draft")
    await page.getByRole("button", { name: /^(발행 설정|발행|새 글 작성|수정 반영)$/ }).first().click()

    const dialog = page.getByRole("dialog", { name: /^(발행 설정|새 글 작성|수정 설정)$/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "닫기" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: /^(발행하기|새 글 작성|변경 반영)$/ })).toBeVisible()
    await expect(page.getByTestId("markdown-editor-live-surface")).toBeVisible()
  })

  test("an unchanged canonical post exits without an unsaved-changes dialog", async ({ page }) => {
    const postId = 771
    await routeAuthenticatedEditor(page)
    await routeEditorPost(page, postId, liveMarkdown)
    await page.goto(`/admin/editor/${postId}`)

    await page.getByRole("button", { name: "← 글 관리" }).click()
    await expect(page.getByRole("dialog", { name: "저장되지 않은 변경이 있습니다" })).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/posts/)
  })

  test("compact layout keeps one usable editor with no orphaned tabs or panels", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await routeAuthenticatedEditor(page)
    await page.goto("/admin/editor/new?source=local-draft")

    const surface = page.getByTestId("markdown-editor-live-surface")
    await expect(surface).toBeVisible()
    await expect(editorContent(page)).toHaveAttribute("aria-label", "Markdown 본문")
    await expect(page.getByRole("tab")).toHaveCount(0)
    await expect(page.getByRole("tabpanel")).toHaveCount(0)
    const box = await surface.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width ?? 999).toBeLessThanOrEqual(393)
    await editorContent(page).focus()
    await editorContent(page).type("한글")
    await expect.poll(() => readMarkdown(page)).toContain("한글")
  })
})
