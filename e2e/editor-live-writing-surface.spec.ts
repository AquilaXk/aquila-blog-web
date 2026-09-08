import { Buffer } from "node:buffer"
import type { Page, Route } from "./helpers/authoringPlaywright"
import { expect, test } from "./helpers/authoringPlaywright"

const localDraftStorageKey = "admin.editor.localDraft.create.v3"
const seededManuscripts = new WeakMap<Page, string>()

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
  if (seedLocalDraft) seededManuscripts.set(page, markdown)
  else seededManuscripts.delete(page)
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

const routeEditorPost = async (page: Page, postId: number, markdown: string, tempDraft = false, contentHtml: string | null = null) => {
  const post = {
    id: postId,
    title: "Existing post",
    content: markdown,
    contentHtml,
    summary: "Existing summary",
    summarySource: "MANUAL",
    summaryIntent: { kind: "manual", summary: "Existing summary" },
    published: false,
    listed: false,
    tempDraft,
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

const restoreSelectedLocalDraft = async (page: Page, content: string) => {
  const candidates = page.getByLabel("복구할 브라우저 초안")
  await expect(candidates).toBeVisible()
  const matchingKey = await page.evaluate((expectedContent) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.endsWith(".v3")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const draft = JSON.parse(raw) as { content?: string; source?: { kind?: string } }
        if (draft.source?.kind === "create" && draft.content === expectedContent) return key
      } catch {}
    }
    return ""
  }, content)
  await candidates.selectOption(matchingKey)
  await page.getByRole("button", { name: "복구" }).click()
}

const openEditorDraft = async (page: Page) => {
  await page.goto("/admin/editor/new?source=local-draft")
  const manuscript = seededManuscripts.get(page)
  if (manuscript !== undefined) await restoreSelectedLocalDraft(page, manuscript)
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
    await openEditorDraft(page)

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

  test("preserves an intentional clear immediately after loading an existing post", async ({ page }) => {
    await routeAuthenticatedEditor(page, liveMarkdown, "Existing post", false)
    await routeEditorPost(page, 770, liveMarkdown)
    await page.goto("/admin/editor/770")
    await expect(page.locator("#post-title")).toHaveValue("Existing post")
    await expect.poll(() => readMarkdown(page)).toBe(liveMarkdown)
    await editorContent(page).fill("")
    await expect.poll(() => readMarkdown(page)).toBe("")
    await editorContent(page).fill("New manuscript")
    await expect.poll(() => readMarkdown(page)).toBe("New manuscript")
  })

  test("groups toolbar actions without overflow and preserves the editor selection", async ({ page }) => {
    await routeAuthenticatedEditor(page, "Hello", "Toolbar grouping")
    await openEditorDraft(page)

    const toolbar = page.getByRole("toolbar", { name: "Markdown 작성 도구" })
    await expect(toolbar).toBeVisible()
    await expect(page.getByRole("combobox", { name: "명령 메뉴" })).toHaveCount(0)

    const headingMenu = page.getByRole("button", { name: "제목 메뉴" })
    await headingMenu.focus()
    await headingMenu.press("ArrowDown")
    await expect(page.getByRole("menu", { name: "제목" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(headingMenu).toBeFocused()

    await headingMenu.click()
    await page.getByRole("button", { name: "목록 메뉴" }).click()
    await expect(page.getByRole("menu", { name: "제목" })).toHaveCount(0)
    const listMenu = page.getByRole("menu", { name: "목록" })
    await expect(listMenu).toBeVisible()
    await expect(listMenu.getByRole("menuitem").first()).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(listMenu).toHaveCount(0)
    await expect(page.getByRole("button", { name: "삽입 메뉴" })).toBeFocused()

    await headingMenu.click()
    await page.locator("#post-title").click()
    await expect(page.getByRole("menu", { name: "제목" })).toHaveCount(0)

    await selectMarkdownRange(page, 0, 5)
    await headingMenu.click()
    await page.getByRole("menuitem", { name: "제목 2" }).click()
    await expect.poll(() => readMarkdown(page)).toBe("## Hello")

    await page.getByRole("button", { name: "표 메뉴" }).click()
    await expect(page.getByRole("menuitem", { name: "표 행 추가" })).toBeDisabled()
    await page.keyboard.press("Escape")

    const layout = await toolbar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      groupOverflowX: getComputedStyle(element.firstElementChild as HTMLElement).overflowX,
      wrappedLabels: Array.from(element.querySelectorAll<HTMLElement>("button, select"))
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => getComputedStyle(control).whiteSpace === "normal")
        .map((control) => control.getAttribute("aria-label") ?? control.textContent?.trim()),
    }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
    expect(layout.groupOverflowX).not.toBe("auto")
    expect(layout.wrappedLabels).toEqual([])

    await page.setViewportSize({ width: 390, height: 844 })
    const compactLayout = await toolbar.evaluate((element) => ({
      toolbarOverflow: element.scrollWidth - element.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(compactLayout.toolbarOverflow).toBe(0)
    expect(compactLayout.documentOverflow).toBe(0)

    await page.setViewportSize({ width: 320, height: 844 })
    const editor = page.getByTestId("markdown-editor")
    const editorBounds = await editor.boundingBox()
    expect(editorBounds).not.toBeNull()
    for (const label of ["제목", "목록", "삽입", "표", "더보기"]) {
      await page.getByRole("button", { name: `${label} 메뉴` }).click()
      const menu = page.getByRole("menu", { name: label })
      const menuBounds = await menu.boundingBox()
      expect(menuBounds).not.toBeNull()
      expect(menuBounds!.x).toBeGreaterThanOrEqual(editorBounds!.x)
      expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(
        editorBounds!.x + editorBounds!.width
      )
      await menu.getByRole("menuitem").first().press("Escape")
    }
  })

  test("selection reveals source for the active block and formats inactive blocks in place", async ({ page }) => {
    const markdown = "# Heading\n\nParagraph with **bold** text."
    await routeAuthenticatedEditor(page, markdown)
    await openEditorDraft(page)

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
    await openEditorDraft(page)

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
    await openEditorDraft(page)

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
    await openEditorDraft(page)
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
    await openEditorDraft(page)
    await selectMarkdownRange(page, 0, 5)
    await page.getByRole("button", { name: /^굵게/ }).click()
    await expect.poll(() => readMarkdown(page)).toBe("**hello**")

    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("hello")
    await editorContent(page).press(redoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("**hello**")

    await fillMarkdown(page, "Cat cat cat")
    await page.getByRole("button", { name: "더보기 메뉴" }).click()
    await page.getByRole("menuitem", { name: "찾기 및 바꾸기" }).click()
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
    await openEditorDraft(page)

    const oneOffset = table.indexOf("one")
    await selectMarkdownRange(page, oneOffset, oneOffset)
    await page.getByRole("button", { name: "표 메뉴" }).click()
    await expect(page.getByRole("menuitem", { name: "표 행 추가", exact: true })).toBeEnabled()
    await page.getByRole("menuitem", { name: "표 행 추가", exact: true }).click()
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

  test("new table insertion enables table commands immediately", async ({ page }) => {
    await routeAuthenticatedEditor(page, "")
    await openEditorDraft(page)

    await page.getByRole("button", { name: "표 메뉴" }).click()
    await page.getByRole("menuitem", { name: /^표 삽입/ }).click()
    await page.getByRole("button", { name: "표 메뉴" }).click()
    await expect(page.getByRole("menuitem", { name: "표 행 추가", exact: true })).toBeEnabled()
    await page.getByRole("menuitem", { name: "표 행 추가", exact: true }).click()
    expect((await readMarkdown(page)).split("\n").filter((line) => line.startsWith("|")).length).toBe(4)
  })

  test("paired input preserves a selected range and remains undoable", async ({ page }) => {
    await routeAuthenticatedEditor(page, "word")
    await openEditorDraft(page)

    await selectMarkdownRange(page, 0, 4)
    await editorContent(page).press("[")
    await expect.poll(() => readMarkdown(page)).toBe("[word]")
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("word")
  })

  test("safe HTML paste preserves content and rejects executable input", async ({ page }) => {
    const source = "prefix target suffix"
    await routeAuthenticatedEditor(page, source)
    await openEditorDraft(page)
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
    await openEditorDraft(page)
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

  test("attachment replacement at document end preserves content and undo history", async ({ page }) => {
    const source = "body"
    const markdown = "[note.txt](https://cdn.example.test/post-files/note.txt)"
    await routeAuthenticatedEditor(page, source)
    await page.route("**/post/api/v1/posts/files", async (route) => {
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "uploaded",
        data: { key: "post-files/note.txt", name: "note.txt", url: "https://cdn.example.test/post-files/note.txt" },
      })
    })
    await openEditorDraft(page)
    await selectMarkdownRangeWithoutAssertion(page, source.length, source.length)
    await page.getByTestId("markdown-editor").locator("input[type='file']:not([accept])").setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("attachment"),
    })
    await expect.poll(() => readMarkdown(page)).toContain(markdown)
    const completed = await readMarkdown(page)
    expect(completed.startsWith(source)).toBe(true)
    expect(completed).not.toContain("uploading:")
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe(source)
    await editorContent(page).press(redoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe(completed)
  })

  test("file drops upload once without inserting raw file text", async ({ page }) => {
    await routeAuthenticatedEditor(page, "drop here")
    await page.route("**/post/api/v1/posts/files", async (route) => {
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "uploaded",
        data: {
          key: "post-files/note.txt",
          name: "note.txt",
          url: "https://cdn.example.test/post-files/note.txt",
        },
      })
    })
    await openEditorDraft(page)

    await editorContent(page).evaluate((element) => {
      const transfer = new DataTransfer()
      transfer.setData("text/plain", "RAW FILE BODY")
      transfer.items.add(new File(["RAW FILE BODY"], "note.txt", { type: "text/plain" }))
      element.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }))
    })

    await expect.poll(() => readMarkdown(page)).toContain(
      "[note.txt](https://cdn.example.test/post-files/note.txt)"
    )
    expect(await readMarkdown(page)).not.toContain("RAW FILE BODY")
  })

  test("upload batch keeps an earlier failure and undo never restores placeholders", async ({ page }) => {
    await routeAuthenticatedEditor(page, "body")
    let uploadRequest = 0
    await page.route("**/post/api/v1/posts/files", async (route) => {
      uploadRequest += 1
      if (uploadRequest === 1) {
        await route.fulfill({ status: 500, body: "failed" })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 650))
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "uploaded",
        data: {
          key: "post-files/kept.txt",
          name: "kept.txt",
          url: "https://cdn.example.test/post-files/kept.txt",
        },
      })
    })
    await openEditorDraft(page)

    await editorContent(page).evaluate((element) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(["first"], "failed.txt", { type: "text/plain" }))
      transfer.items.add(new File(["second"], "kept.txt", { type: "text/plain" }))
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      }))
    })

    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toHaveText(
      "첨부 파일 업로드에 실패했습니다."
    )
    await expect.poll(() => readMarkdown(page)).toContain(
      "[kept.txt](https://cdn.example.test/post-files/kept.txt)"
    )
    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toHaveText(
      "첨부 파일 업로드에 실패했습니다."
    )
    await editorContent(page).press(undoShortcut)
    await expect.poll(() => readMarkdown(page)).toBe("body")
    expect(await readMarkdown(page)).not.toContain("uploading:")
  })

  test("oversized attachments fail before the upload boundary", async ({ page }) => {
    await routeAuthenticatedEditor(page, "body")
    let uploadCalled = false
    await page.route("**/post/api/v1/posts/files", async (route) => {
      uploadCalled = true
      await route.fulfill({ status: 500, body: "unexpected upload" })
    })
    await openEditorDraft(page)

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
    await openEditorDraft(page)
    await page.locator("#post-title").fill(title)
    await fillMarkdown(page, content)
    await editorContent(page).press(saveShortcut)

    await expect.poll(() => page.evaluate(({ expectedTitle, expectedContent }) => {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        const raw = key ? localStorage.getItem(key) : null
        if (!raw) continue
        const draft = JSON.parse(raw) as { title: string; content: string; source?: { kind?: string } }
        if (draft.source?.kind === "create" && draft.title === expectedTitle && draft.content === expectedContent) return true
      }
      return false
    }, { expectedTitle: title, expectedContent: content })).toBe(true)

    await openEditorDraft(page)
    await restoreSelectedLocalDraft(page, content)
    await expect(page.locator("#post-title")).toHaveValue(title)
    await expect.poll(() => readMarkdown(page)).toBe(content)
  })

  test("whitespace-only summaries autosave as an empty draft and survive reload", async ({ page }) => {
    const title = "공백 요약 초안"
    const content = "공백 요약도 본문은 보존해야 합니다."
    await routeAuthenticatedEditor(page, "", title, false)
    await openEditorDraft(page)
    await page.locator("#post-title").fill(title)
    await fillMarkdown(page, content)
    await page.getByLabel("Summary").fill("수동 요약")
    await expect.poll(() => page.evaluate((expectedContent) => {
      const key = Object.keys(localStorage).find((entry) => entry.startsWith("admin.editor.localDraft.create.") && JSON.parse(localStorage.getItem(entry) || "{}").content === expectedContent)
      const raw = key ? window.localStorage.getItem(key) : null
      if (!raw) return null
      const draft = JSON.parse(raw) as { summary: string; summarySource: string }
      return { summary: draft.summary, summarySource: draft.summarySource }
    }, content)).toEqual({ summary: "수동 요약", summarySource: "MANUAL" })

    await page.getByLabel("Summary").fill("   ")
    await expect.poll(() => page.evaluate((expectedContent) => {
      const key = Object.keys(localStorage).find((entry) => entry.startsWith("admin.editor.localDraft.create.") && JSON.parse(localStorage.getItem(entry) || "{}").content === expectedContent)
      const raw = key ? window.localStorage.getItem(key) : null
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
    }, content)).toEqual({
      content,
      summary: "",
      summarySource: "NONE",
      intentKind: "auto",
    })

    await openEditorDraft(page)
    await restoreSelectedLocalDraft(page, content)
    await expect.poll(() => readMarkdown(page)).toBe(content)
    await expect(page.getByLabel("Summary")).toHaveValue("")
  })

  for (const manuscript of ["", "Intro\n\n```ts\n\n```", "Intro\n\n~~~ts title=example.ts\n\n~~~"]) {
  test(`preserves current manuscript without HTML or public recovery: ${manuscript || "empty"}`, async ({ page }) => {
    const postId = 774
    await routeAuthenticatedEditor(page, liveMarkdown, "Existing post", false)
    await routeEditorPost(page, postId, manuscript, false, "<p>Intro</p><pre><code>oldCode()</code></pre>")
    let publicReads = 0
    await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
      publicReads += 1
      await fulfillJson(route, { content: liveMarkdown, contentHtml: "<p>Old body</p>" })
    })
    await page.goto(`/admin/editor/${postId}`)
    await expect(page.getByPlaceholder("제목을 입력하세요", { exact: true })).toHaveValue("Existing post")
    await expect.poll(() => readMarkdown(page)).toBe(manuscript)
    expect(publicReads).toBe(0)
  })
  }

  for (const nextSummary of ["Newer manual summary", ""]) {
    test(`preserves newer summary intent after a delayed save: ${nextSummary ? "manual" : "auto"}`, async ({ page }) => {
      const postId = 771
      await routeAuthenticatedEditor(page, liveMarkdown, "Existing post", false)
      await routeEditorPost(page, postId, liveMarkdown)
      await page.route("**/api/revalidate", (route) => fulfillJson(route, { revalidated: true }))
      let pendingWrite: Route | undefined
      await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
        if (route.request().method() !== "PUT") {
          await route.fallback()
          return
        }
        pendingWrite = route
      })
      await page.goto(`/admin/editor/${postId}`)
      const summary = page.getByLabel(/^Summary/)
      await summary.fill("Saved summary")
      await page.getByRole("button", { name: "발행 설정", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: /^(발행 설정|수정 설정)$/ })
      await dialog.getByRole("button", { name: "변경 반영", exact: true }).click()
      await expect.poll(() => pendingWrite?.request().postDataJSON().summary).toBe("Saved summary")
      await expect(summary).toBeEnabled()
      // 서랍이 열린 상태에서도 변경 이벤트를 받아들이는 입력의 지연 응답 경계를 검증한다.
      await summary.fill(nextSummary, { force: true })
      await fulfillJson(pendingWrite!, {
        resultCode: "200-1", msg: "saved",
        data: { id: postId, version: 2, summary: "Saved summary", summarySource: "MANUAL" },
      })
      await expect(dialog).toHaveCount(0)
      await expect(summary).toHaveValue(nextSummary)
      await expect.poll(() => page.evaluate((id) => {
        const key = Object.keys(localStorage).find((entry) => entry.startsWith(`admin.editor.localDraft.post.${id}.`) && entry.endsWith(".v3"))
        const raw = key ? localStorage.getItem(key) : null
        if (!raw) return null
        const draft = JSON.parse(raw)
        return { summary: draft.summary, intent: draft.summaryIntent }
      }, postId)).toEqual({
        summary: nextSummary,
        intent: nextSummary ? { kind: "manual", summary: nextSummary } : { kind: "auto" },
      })
    })
  }

  test("dismissed recovery candidates stay hidden when another draft arrives", async ({ page }) => {
    await routeAuthenticatedEditor(page)
    await page.goto("/admin/editor/new?source=local-draft")
    const candidates = page.getByLabel("복구할 브라우저 초안")
    await expect(candidates).toBeVisible()
    await page.getByRole("button", { name: "이번 세션에 표시 안 함", exact: true }).click()
    await expect(candidates).toHaveCount(0)
    const nextKey = await page.evaluate((originalKey) => {
      const key = "admin.editor.localDraft.create.another-document.v3"
      const draft = JSON.parse(localStorage.getItem(originalKey) || "null")
      localStorage.setItem(key, JSON.stringify({ ...draft, content: "Another manuscript" }))
      window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }))
      return key
    }, localDraftStorageKey)
    await expect(candidates).toBeVisible()
    await expect(candidates.locator(`option[value="${localDraftStorageKey}"]`)).toHaveCount(0)
    await expect(candidates.locator(`option[value="${nextKey}"]`)).toHaveCount(1)
  })

  test("saving one tab preserves the other tab manuscript for explicit recovery", async ({ page }) => {
    const other = await page.context().newPage()
    const postId = 776
    try {
      for (const tab of [page, other]) {
        await routeAuthenticatedEditor(tab, liveMarkdown, "Existing post", false)
        await routeEditorPost(tab, postId, liveMarkdown)
        await tab.goto(`/admin/editor/${postId}`)
        await expect(tab.locator("#post-title")).toHaveValue("Existing post")
      }
      await fillMarkdown(page, "Manuscript from A")
      await fillMarkdown(other, "Unsaved manuscript from B")
      await expect.poll(() => page.evaluate((id) => Object.keys(localStorage).some((key) =>
        key.startsWith(`admin.editor.localDraft.post.${id}.`) &&
        JSON.parse(localStorage.getItem(key) || "{}").content === "Manuscript from A"
      ), postId)).toBe(true)
      const readOtherKey = () => page.evaluate((id) => Object.keys(localStorage).find((key) => {
        if (!key.startsWith(`admin.editor.localDraft.post.${id}.`)) return false
        return JSON.parse(localStorage.getItem(key) || "{}").content === "Unsaved manuscript from B"
      }) || "", postId)
      await expect.poll(readOtherKey).not.toBe("")
      const otherKey = await readOtherKey()
      await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
        if (route.request().method() !== "PUT") return route.fallback()
        await fulfillJson(route, { resultCode: "200-1", msg: "saved", data: {
          id: postId, version: 2, summary: "Existing summary", summarySource: "MANUAL",
        } })
      })
      await page.route("**/api/revalidate", (route) => fulfillJson(route, { revalidated: true }))
      await page.getByRole("button", { name: "발행 설정", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: /^(발행 설정|수정 설정)$/ })
      await dialog.getByRole("button", { name: "변경 반영", exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(await readOtherKey()).toBe(otherKey)
      await other.reload()
      const candidates = other.getByLabel("복구할 브라우저 초안")
      await candidates.selectOption(otherKey)
      await other.getByRole("button", { name: "복구", exact: true }).click()
      await expect.poll(() => readMarkdown(other)).toBe("Unsaved manuscript from B")
      expect(await readOtherKey()).toBe(otherKey)
    } finally {
      await other.close()
    }
  })

  test("publish workflow remains available from the unified editor", async ({ page }) => {
    await routeAuthenticatedEditor(page)
    await openEditorDraft(page)
    await page.getByRole("button", { name: /^(발행 설정|발행|새 글 작성|수정 반영)$/ }).first().click()

    const dialog = page.getByRole("dialog", { name: /^(발행 설정|새 글 작성|수정 설정)$/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId("publish-preview-panel")).toHaveCount(0)
    await expect(dialog.getByRole("tablist", { name: "포스트 카드 미리보기 기기" })).toHaveCount(0)
    const visibility = dialog.getByRole("group", { name: "노출 범위 선택" })
    await expect(visibility).toBeVisible()
    const privateOption = visibility.getByRole("button", { name: /비공개/ })
    await privateOption.click()
    await expect(privateOption).toHaveAttribute("aria-pressed", "true")
    await expect(dialog.getByRole("button", { name: "닫기" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: /^(발행하기|새 글 작성|변경 반영)$/ })).toBeVisible()
    await expect(page.getByTestId("markdown-editor-live-surface")).toBeVisible()
  })

  test("blocked browser draft storage leaves the manuscript editable and reports failure", async ({ page }) => {
    await routeAuthenticatedEditor(page, "", "Storage failure", false)
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("admin.editor.localDraft.")) {
          throw new DOMException("Storage unavailable", "QuotaExceededError")
        }
        return setItem.call(this, key, value)
      }
    })
    await openEditorDraft(page)
    const manuscript = "원고는 저장소 오류가 나도 편집기에 남아 있어야 합니다."
    await page.locator("#post-title").fill("Storage failure")
    await fillMarkdown(page, manuscript)
    await expect(page.getByText(
      "브라우저 임시저장에 실패했습니다. 현재 원고를 복사하거나 서버에 저장한 뒤 페이지를 닫아주세요.",
      { exact: true }
    )).toBeVisible()
    await expect.poll(() => readMarkdown(page)).toBe(manuscript)
    await expect(editorContent(page)).toBeEditable()
  })

  test("failed candidate deletion preserves selection, stored draft and manuscript", async ({ page }) => {
    await routeAuthenticatedEditor(page, "Stored recovery manuscript")
    await page.goto("/admin/editor/new?source=local-draft")
    const candidates = page.getByLabel("복구할 브라우저 초안")
    await candidates.selectOption(localDraftStorageKey)
    await fillMarkdown(page, "Current unsaved manuscript")
    const original = await page.evaluate((key) => {
      const value = localStorage.getItem(key)
      const removeItem = Storage.prototype.removeItem
      Storage.prototype.removeItem = function (target) {
        if (target === key) throw new DOMException("blocked", "SecurityError")
        return removeItem.call(this, target)
      }
      return value
    }, localDraftStorageKey)
    await page.getByRole("button", { name: "삭제", exact: true }).click()
    await expect(page.getByText("선택한 브라우저 임시글을 삭제하지 못했습니다.", { exact: false })).toBeVisible()
    await expect(candidates).toHaveValue(localDraftStorageKey)
    expect(await page.evaluate((key) => localStorage.getItem(key), localDraftStorageKey)).toBe(original)
    await expect.poll(() => readMarkdown(page)).toBe("Current unsaved manuscript")
  })

  test("candidate list read failure keeps the selected manuscript", async ({ page }) => {
    await routeAuthenticatedEditor(page, "Selected recovery manuscript")
    await openEditorDraft(page)
    await expect.poll(() => readMarkdown(page)).toBe("Selected recovery manuscript")
    await page.evaluate(() => {
      const originalKey = Storage.prototype.key
      Storage.prototype.key = function () {
        throw new DOMException("blocked", "SecurityError")
      }
      window.dispatchEvent(new StorageEvent("storage", { storageArea: localStorage }))
      window.setTimeout(() => { Storage.prototype.key = originalKey }, 0)
    })
    await expect(page.getByText("브라우저 임시글 목록을 읽지 못했습니다")).toBeVisible()
    await expect.poll(() => readMarkdown(page)).toBe("Selected recovery manuscript")
  })

  test("a delayed temporary-post publish preserves a newer visibility selection", async ({ page }) => {
    const postId = 771
    const title = "Publish visibility concurrency"
    await routeAuthenticatedEditor(page, liveMarkdown, "Existing post", false)
    await routeEditorPost(page, postId, liveMarkdown, true)
    await page.route("**/api/revalidate", (route) => fulfillJson(route, { revalidated: true }))
    let pendingWrite: Route | undefined
    await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback()
        return
      }
      pendingWrite = route
    })
    await page.goto(`/admin/editor/${postId}`)
    // 임시글은 제목을 빈 입력으로 시작하므로 실제 작성처럼 필수 제목을 입력한다.
    await page.getByPlaceholder("제목을 입력하세요", { exact: true }).fill(title)
    await page.getByRole("button", { name: "발행 설정", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "새 글 작성", exact: true })
    await dialog.getByRole("button", { name: /전체 공개/ }).click()
    await dialog.getByRole("button", { name: "새 글 작성", exact: true }).click()
    await expect.poll(() => pendingWrite?.request().postDataJSON().published).toBe(true)
    expect(pendingWrite?.request().postDataJSON().title).toBe(title)
    await dialog.getByRole("button", { name: /비공개/ }).click()
    await fulfillJson(pendingWrite!, {
      resultCode: "200-1", msg: "saved",
      data: { id: postId, version: 2, summary: "Existing summary", summarySource: "MANUAL" },
    })
    await expect(dialog).toHaveCount(0)
    await page.getByRole("button", { name: "발행 설정", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "수정 설정", exact: true })
      .getByRole("button", { name: /비공개/ })).toHaveAttribute("aria-pressed", "true")
  })

  test("a failed public refresh does not report a committed update as a failed save", async ({ page }) => {
    const postId = 771
    let writes = 0
    await routeAuthenticatedEditor(page, liveMarkdown, "Existing post", false)
    await routeEditorPost(page, postId, liveMarkdown)
    await page.route("**/api/revalidate", (route) =>
      route.fulfill({ status: 500, body: "refresh unavailable" }))
    await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback()
        return
      }
      writes += 1
      await fulfillJson(route, {
        resultCode: "200-1", msg: "saved",
        data: { id: postId, version: 2, summary: "Saved summary", summarySource: "MANUAL" },
      })
    })
    await page.goto(`/admin/editor/${postId}`)
    await page.getByLabel(/^Summary/).fill("Saved summary")
    await page.getByRole("button", { name: "발행 설정", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: /^(발행 설정|수정 설정)$/ })
    await dialog.getByRole("button", { name: "변경 반영", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(
      "저장은 완료됐지만 공개 화면 갱신에 실패했습니다. 다시 저장할 필요는 없습니다.",
      { exact: true }
    )).toBeVisible()
    await expect(page.getByLabel(/^Summary/)).toHaveValue("Saved summary")
    expect(writes).toBe(1)
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
    await openEditorDraft(page)

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

  test("constrained editor height can scroll the final line into view", async ({ page }) => {
    const lines = Array.from({ length: 80 }, (_, index) => `line ${index + 1}`)
    const markdown = lines.join("\n")
    await routeAuthenticatedEditor(page, markdown)
    await openEditorDraft(page)
    await page.getByTestId("markdown-editor").evaluate((element) => {
      element.style.height = "280px"
    })

    const scroller = page.locator(".cm-scroller")
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    // 가상화된 DOM의 마지막 항목이 아니라 원문의 마지막 줄을 확인한다.
    const finalLine = editorContent(page).getByText(lines[lines.length - 1], { exact: true })
    await expect(finalLine).toBeVisible()
    await expect.poll(async () => {
      const bodyBox = await page.getByTestId("markdown-editor-live-surface").boundingBox()
      const lineBox = await finalLine.boundingBox()
      if (!bodyBox || !lineBox) return false
      return lineBox.y >= bodyBox.y && lineBox.y + lineBox.height <= bodyBox.y + bodyBox.height + 1
    }).toBe(true)
  })
})
