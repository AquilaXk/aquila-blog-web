import { Buffer } from "node:buffer"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import summaryFixtures from "../contracts/platform/summary-fixtures.json"
import type { Page, Route } from "./helpers/authoringPlaywright"
import { expect, test } from "./helpers/authoringPlaywright"

const sourcePath = (...segments: string[]) => resolve(__dirname, "../src", ...segments)
const frontPath = (...segments: string[]) => resolve(__dirname, "..", ...segments)
const joinParts = (...parts: string[]) => parts.join("")
const localDraftStorageKey = "admin.editor.localDraft.create.v3"
const categoryCatalogStorageKey = "admin.editor.customCategories"
const leadingBlockSummaryFixture = summaryFixtures.fixtures.find((fixture) => fixture.id === "leading-block")
if (!leadingBlockSummaryFixture) throw new Error("leading-block summary fixture is required")
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
const longMarkdownDraft = [
  "# Markdown Rendering Contract",
  "",
  "아래 내용은 507 긴 본문 하단에서 반복되던 table/code/list 선택 문제를 대체 경로로 검증한다.",
  "",
  "- [ ] task item at bottom",
  "- [x] checked item at bottom",
  "",
  "| Column 1 | Column 2 | Column 3 |",
  "| --- | --- | --- |",
  "| 507 | table | bottom |",
  "| drag | selection | stable |",
  "",
  "```js",
  "console.log(\"507-code\")",
  "```",
  "",
  "> quote at the bottom",
].join("\n")

const scrollSyncImagePath = "/e2e-scroll-sync-shot.png"
const scrollSyncSectionCount = 64
const scrollSyncCheckpoints = [1, 16, 32, 48, 64]
const scrollSyncAlignmentTolerancePx = 48

/**
 * heading·문단·코드 펜스·인용·표·이미지·Mermaid가 섞이고 마지막에 heading 없는 tail 문단이 이어지는
 * fixture. 모든 줄은 split pane에서 줄바꿈되지 않도록 짧게 유지해 source heading 위치를
 * `paddingTop + lineIndex * lineHeight`로 정확히 계산할 수 있게 한다.
 */
const buildScrollSyncMarkdown = (sectionCount = scrollSyncSectionCount) => {
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const section = index + 1
    const blocks = [
      `## Section ${section}`,
      "",
      `paragraph body for section ${section}`,
      "",
      "```ts",
      `const section${section} = ${section}`,
      "```",
      "",
      `> quoted note for section ${section}`,
      "",
      "| col a | col b |",
      "| --- | --- |",
      `| v ${section} | r ${section} |`,
      "",
    ]
    if (section % 16 === 3) blocks.push(`![shot ${section}](${scrollSyncImagePath})`, "")
    if (section % 16 === 5) {
      blocks.push("```mermaid", "graph TD;", `  A${section} --> B${section};`, "```", "")
    }
    return blocks.join("\n")
  })
  const tail = Array.from({ length: 40 }, (_, index) => `tail paragraph ${index + 1}`).join("\n\n")

  return `${sections.join("\n")}\n\n${tail}\n`
}

const routeScrollSyncImage = async (page: Page) => {
  await page.route(`**${scrollSyncImagePath}`, async (route) => {
    await route.fulfill({ contentType: "image/png", body: onePixelPng })
  })
}

const readSectionAlignmentError = (page: Page, section: number, headingPrefix = "Section") =>
  page.evaluate(({ targetSection, prefix }) => {
    const writePane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-write-pane']")
    const textarea = writePane?.querySelector<HTMLTextAreaElement>("textarea")
    const preview = document.querySelector<HTMLElement>("[data-testid='markdown-editor-preview-pane']")
    if (!writePane || !textarea || !preview) throw new Error("split pane elements not found")

    const marker = `## ${prefix} ${targetSection}\n`
    const markerIndex = textarea.value.indexOf(marker)
    if (markerIndex < 0) throw new Error(`${marker.trim()} source marker not found`)

    const style = window.getComputedStyle(textarea)
    const lineHeight = Number.parseFloat(style.lineHeight)
    const paddingTop = Number.parseFloat(style.paddingTop)
    const lineIndex = textarea.value.slice(0, markerIndex).split("\n").length - 1
    const writeHeadingTop =
      textarea.getBoundingClientRect().top -
      writePane.getBoundingClientRect().top +
      paddingTop +
      lineIndex * lineHeight -
      textarea.scrollTop

    const previewHeading = Array.from(preview.querySelectorAll<HTMLElement>(".aq-markdown h2")).find(
      (candidate) => candidate.textContent?.trim() === `${prefix} ${targetSection}`
    )
    if (!previewHeading) throw new Error(`${prefix} ${targetSection} preview heading not found`)
    const previewHeadingTop =
      previewHeading.getBoundingClientRect().top - preview.getBoundingClientRect().top

    return Math.abs(writeHeadingTop - previewHeadingTop)
  }, { targetSection: section, prefix: headingPrefix })

const scrollWriteToSection = (page: Page, section: number, headingPrefix = "Section") =>
  page.evaluate(({ targetSection, prefix }) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "[data-testid='markdown-editor-write-pane'] textarea"
    )
    if (!textarea) throw new Error("write textarea not found")

    const marker = `## ${prefix} ${targetSection}\n`
    const markerIndex = textarea.value.indexOf(marker)
    if (markerIndex < 0) throw new Error(`${marker.trim()} source marker not found`)

    const style = window.getComputedStyle(textarea)
    const lineHeight = Number.parseFloat(style.lineHeight)
    const paddingTop = Number.parseFloat(style.paddingTop)
    const lineIndex = textarea.value.slice(0, markerIndex).split("\n").length - 1
    const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight)
    textarea.scrollTop = Math.max(
      0,
      Math.min(paddingTop + lineIndex * lineHeight - textarea.clientHeight * 0.25, maxScrollTop)
    )
    textarea.dispatchEvent(new Event("scroll", { bubbles: true }))
  }, { targetSection: section, prefix: headingPrefix })

const scrollPreviewToSection = (page: Page, section: number, headingPrefix = "Section") =>
  page.evaluate(({ targetSection, prefix }) => {
    const preview = document.querySelector<HTMLElement>("[data-testid='markdown-editor-preview-pane']")
    if (!preview) throw new Error("preview pane not found")

    const heading = Array.from(preview.querySelectorAll<HTMLElement>(".aq-markdown h2")).find(
      (candidate) => candidate.textContent?.trim() === `${prefix} ${targetSection}`
    )
    if (!heading) throw new Error(`${prefix} ${targetSection} preview heading not found`)

    const headingTop =
      heading.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop
    const maxScrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight)
    preview.scrollTop = Math.max(0, Math.min(headingTop - preview.clientHeight * 0.25, maxScrollTop))
    preview.dispatchEvent(new Event("scroll", { bubbles: true }))
  }, { targetSection: section, prefix: headingPrefix })

const expectBidirectionalHeadingAlignment = async (page: Page, checkpoints = scrollSyncCheckpoints) => {
  for (const section of checkpoints) {
    await scrollWriteToSection(page, section)
    await expect
      .poll(() => readSectionAlignmentError(page, section), {
        message: `write Section ${section} should align with the same preview heading`,
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)
  }

  for (const section of [...checkpoints].reverse()) {
    await scrollPreviewToSection(page, section)
    await expect
      .poll(() => readSectionAlignmentError(page, section), {
        message: `preview Section ${section} should align with the same source heading`,
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)
  }
}

const fulfillJson = async (route: Route, data: unknown) => {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(data),
  })
}

const routeAuthenticatedEditor = async (
  page: Page,
  markdown = longMarkdownDraft,
  title = "Markdown 작성 테스트",
  seedLocalDraft = true
) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await fulfillJson(route, adminMember)
  })
  await page.route("**/post/api/v1/posts/tags", async (route) => {
    await fulfillJson(route, [])
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
    ({ storageKey, content, title }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          title,
          content,
          summary: "Markdown split editor test",
          summarySource: "MANUAL",
          summaryIntent: { kind: "manual", summary: "Markdown split editor test" },
          thumbnailUrl: "",
          thumbnailFocusX: 50,
          thumbnailFocusY: 50,
          thumbnailZoom: 1,
          tags: ["markdown", "507"],
          category: "",
          visibility: "PUBLIC_UNLISTED",
          savedAt: new Date().toISOString(),
          source: { kind: "create" },
        })
      )
    },
    { storageKey: localDraftStorageKey, content: markdown, title }
  )
}

const routeEditorPost = async (page: Page, postId: number, markdown: string) => {
  const post = {
    id: postId,
    title: "Markdown 수정 테스트",
    content: markdown,
    summary: "Markdown 수정 테스트",
    summarySource: "MANUAL",
    summaryIntent: { kind: "manual", summary: "Markdown 수정 테스트" },
    published: false,
    listed: false,
    tempDraft: false,
    version: 1,
  }

  await page.route(`**/post/api/v1/adm/posts/${postId}`, async (route) => {
    await fulfillJson(route, post)
  })
  await page.route(`**/post/api/v1/posts/${postId}`, async (route) => {
    await fulfillJson(route, { content: markdown, contentHtml: null })
  })
}

test.describe("Markdown editor replacement", () => {
  test("legacy block editor implementation and route files are removed from the frontend tree", () => {
    const forbiddenPaths = [
      sourcePath("components", "editor"),
      sourcePath("pages", "_qa", joinParts("block", "-", "editor", "-", "slash.tsx")),
      sourcePath("routes", "Admin", joinParts("Qa", "Editor", "Harness.tsx")),
    ]

    expect(forbiddenPaths.filter((path) => existsSync(path))).toEqual([])
  })

  test("authoring e2e suite no longer depends on legacy block editor selectors", () => {
    const e2eRoot = frontPath("e2e")
    const forbiddenPatterns = [
      joinParts("Block", "Editor", "Engine"),
      joinParts("Block", "Editor", "Shell"),
      joinParts("block", "-", "editor", "-", "prose", "mirror"),
      joinParts("_qa/", "block", "-", "editor", "-", "slash"),
      joinParts(".aq-", "block", "-", "editor", "__content"),
      "aq-code-editor-content",
      "aq-code-highlight-layer",
      "data-code-block-wrapper",
    ]
    const allowedFiles = new Set(["editor-authoring-markdown-editor.spec.ts"])
    const violations: string[] = []

    const scan = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const entryPath = resolve(directory, entry)
        const stat = statSync(entryPath)
        if (stat.isDirectory()) {
          if (entry === "node_modules" || entry === "test-results" || entry === "playwright-report") continue
          scan(entryPath)
          continue
        }
        if (!entryPath.endsWith(".ts") || allowedFiles.has(entry)) continue

        const source = readFileSync(entryPath, "utf8")
        const matched = forbiddenPatterns.filter((pattern) => source.includes(pattern))
        if (matched.length > 0) violations.push(`${entryPath.replace(`${frontPath("")}/`, "")}: ${matched.join(", ")}`)
      }
    }

    scan(e2eRoot)

    expect(violations).toEqual([])
  })

  test("writer host uses Markdown split editor instead of the legacy block editor", () => {
    const writerHostSource = readFileSync(sourcePath("routes/Admin/WriterEditorHost.tsx"), "utf8")
    const markdownEditorSource = readFileSync(
      sourcePath("components/markdown-editor/MarkdownEditor.tsx"),
      "utf8"
    )

    expect(writerHostSource).not.toContain(joinParts("Block", "Editor", "Shell"))
    expect(writerHostSource).not.toContain(joinParts("block", "Editor", "Contract"))
    expect(writerHostSource).toContain("MarkdownEditor")
    expect(markdownEditorSource).toContain("MarkdownRenderer")
  })

  test("legacy block editor user affordances are not part of the dedicated writer surface", () => {
    const dedicatedSurfaceSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioDedicatedEditorSurface.tsx"),
      "utf8"
    )
    const composeRootSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioWorkspaceControllerRootView.tsx"),
      "utf8"
    )

    expect(dedicatedSurfaceSource).not.toContain("block-drag-handle")
    expect(dedicatedSurfaceSource).not.toContain("keyboard-block-selection-overlay")
    expect(composeRootSource).not.toContain(joinParts("BLOCK", "_EDITOR", "_V2", "_MERMAID", "_ENABLED"))
    expect(composeRootSource).not.toContain(joinParts("handle", "Block", "Editor", "Change"))
  })

  test("publish confirmation modal follows the admin neutral dialog contract", async ({ page }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")
    await page.getByRole("button", { name: /^(발행 설정|발행|새 글 작성|수정 반영)$/ }).first().click()

    const dialog = page.getByRole("dialog", { name: /^(발행 설정|새 글 작성|수정 설정)$/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "닫기" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: /^(발행하기|새 글 작성|변경 반영)$/ })).toBeVisible()

    const dialogContract = await dialog.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        width: element.getBoundingClientRect().width,
        backgroundImage: style.backgroundImage,
      }
    })

    expect(dialogContract.borderRadius).toBeLessThanOrEqual(12)
    expect(dialogContract.width).toBeLessThanOrEqual(1120)
    expect(dialogContract.backgroundImage).toBe("none")
  })

  test("publish modal uses an admin workflow layout instead of stacked explanation cards", async ({ page }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")
    await page.getByRole("button", { name: /^(발행 설정|발행|새 글 작성|수정 반영)$/ }).first().click()

    const dialog = page.getByRole("dialog", { name: /^(발행 설정|새 글 작성|수정 설정)$/ })
    await expect(dialog).toBeVisible()

    const layout = await dialog.evaluate((element) => {
      const previewPanel = element.querySelector<HTMLElement>("[data-testid='publish-preview-panel']")
      const visibilityPanel = element.querySelector<HTMLElement>("[data-testid='publish-visibility-panel']")
      const optionButtons = Array.from(element.querySelectorAll<HTMLButtonElement>("[aria-pressed]"))
      const optionHeights = optionButtons.map((button) => button.getBoundingClientRect().height)
      const previewRect = previewPanel?.getBoundingClientRect()
      const visibilityRect = visibilityPanel?.getBoundingClientRect()

      return {
        previewLeft: previewRect?.left ?? 0,
        visibilityLeft: visibilityRect?.left ?? 0,
        maxOptionHeight: Math.max(...optionHeights),
        optionCount: optionButtons.length,
      }
    })

    expect(layout.optionCount).toBe(3)
    expect(layout.previewLeft).toBeLessThan(layout.visibilityLeft)
    expect(layout.maxOptionHeight).toBeLessThanOrEqual(60)
  })

  test("publish modal shell styles stay in the modal style primitive file", () => {
    const publishModalSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModal.tsx"),
      "utf8"
    )
    const publishModalStylesSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModalStyles.tsx"),
      "utf8"
    )
    const publishModalShellStylesSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModalShellStyles.tsx"),
      "utf8"
    )

    expect(publishModalSource).not.toContain("const PublishModalBackdrop = styled.")
    expect(publishModalSource).not.toContain("const PublishDialog = styled.")
    expect(publishModalSource).not.toContain("const PublishModalHeader = styled.")
    expect(publishModalSource).not.toContain("const PublishModalBody = styled.")
    expect(publishModalSource).not.toContain("const PublishModalFooter = styled.")
    expect(publishModalSource).toContain('from "./EditorStudioPublishModalStyles"')
    expect(publishModalStylesSource).toContain('from "./EditorStudioPublishModalShellStyles"')
    expect(publishModalShellStylesSource).toContain("export const PublishModalBackdrop")
    expect(publishModalShellStylesSource).toContain("export const PublishDialog")
    expect(publishModalShellStylesSource).toContain("export const PublishModalHeader")
    expect(publishModalShellStylesSource).toContain("export const PublishModalBody")
    expect(publishModalShellStylesSource).toContain("export const PublishModalFooter")
  })

  test("/editor/new renders Markdown write and preview panes for 507-style bottom content", async ({
    page,
  }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")

    await expect(page.getByPlaceholder("제목을 입력하세요").first()).toHaveValue("Markdown 작성 테스트")
    await expect(page.getByTestId("markdown-editor")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-write-pane")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()
    await expect(page.locator("[data-testid='keyboard-block-selection-overlay']")).toHaveCount(0)
    await expect(page.locator("[data-testid='block-drag-handle']")).toHaveCount(0)

    const preview = page.getByTestId("markdown-editor-preview-pane")
    await expect(preview.getByRole("heading", { name: "Markdown Rendering Contract" })).toBeVisible()
    await expect(preview.locator("table")).toContainText("507")
    await expect(preview.locator("pre")).toContainText("console.log(\"507-code\")")
    await expect(preview.locator("input[type='checkbox']")).toHaveCount(2)
    await expect(preview.getByText("quote at the bottom")).toBeVisible()
  })

  test("editor preview resolves a footnote across a toggle boundary", async ({ page }) => {
    await routeAuthenticatedEditor(page, [
      "본문의 정책 참조입니다.[^policy]",
      "",
      '[위장 링크](#aq-footnote-1 "aq-footnote-ref-1-1")',
      "",
      ":::toggle 정책 근거",
      "토글은 비어 있지 않은 본문을 유지합니다.",
      ":::",
      "",
      "[^policy]: 문서 끝의 정책 근거",
    ].join("\n"))

    await page.goto("/editor/new?source=local-draft")

    const markdown = page.getByTestId("markdown-editor-preview-pane").locator(".aq-markdown")
    const reference = markdown.locator("a[data-footnote-ref]")
    await expect(reference).toHaveCount(1)
    await expect(reference).toHaveAccessibleName(/각주 \d+ 참조 \d+/)
    const targetHref = await reference.getAttribute("href")
    const referenceId = await reference.getAttribute("id")
    if (!targetHref?.startsWith("#") || !referenceId) throw new Error("footnote reference relationship is required")

    const target = markdown.locator(`[id="${targetHref.slice(1)}"]`)
    await expect(target).toHaveCount(1)
    await expect(target).toContainText("문서 끝의 정책 근거")
    await expect(target.locator("a[data-footnote-backref]")).toHaveAttribute("href", `#${referenceId}`)
  })

  test("split preview aligns the Markdown body and keeps the public header for Preview mode", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await routeAuthenticatedEditor(page, "ㄷㄷㄷ")

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const previewPane = page.getByTestId("markdown-editor-preview-pane")
    await expect(writePane.locator("textarea")).toBeVisible()
    await expect(previewPane.getByText("ㄷㄷㄷ")).toBeVisible()
    await expect(previewPane.getByText("Public preview", { exact: true })).toBeHidden()

    const startPointContract = await page.evaluate(() => {
      const writePane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-write-pane']")
      const previewPane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-preview-pane']")
      const textarea = writePane?.querySelector<HTMLTextAreaElement>("textarea")
      const firstPreviewBlock = previewPane?.querySelector<HTMLElement>(".aq-markdown > :first-child")
      if (!writePane || !previewPane || !textarea || !firstPreviewBlock) {
        throw new Error("markdown split pane elements not found")
      }

      const writePaneRect = writePane.getBoundingClientRect()
      const previewPaneRect = previewPane.getBoundingClientRect()
      const textareaRect = textarea.getBoundingClientRect()
      const textareaStyle = window.getComputedStyle(textarea)
      const firstPreviewBlockRect = firstPreviewBlock.getBoundingClientRect()

      return {
        writeStartLeft: textareaRect.left + Number.parseFloat(textareaStyle.paddingLeft) - writePaneRect.left,
        writeStartTop: textareaRect.top + Number.parseFloat(textareaStyle.paddingTop) - writePaneRect.top,
        previewStartLeft: firstPreviewBlockRect.left - previewPaneRect.left,
        previewStartTop: firstPreviewBlockRect.top - previewPaneRect.top,
      }
    })

    expect(Math.abs(startPointContract.writeStartLeft - startPointContract.previewStartLeft)).toBeLessThanOrEqual(12)
    expect(Math.abs(startPointContract.writeStartTop - startPointContract.previewStartTop)).toBeLessThanOrEqual(12)

    await page.getByRole("tab", { name: "Preview" }).click()
    await expect(page.getByTestId("markdown-editor-write-pane")).toHaveCount(0)
    await expect(previewPane.getByText("Public preview", { exact: true })).toBeVisible()
    await expect(previewPane.getByRole("heading", { name: "Markdown 작성 테스트", exact: true })).toBeVisible()
    await expect(previewPane.getByText("Markdown split editor test", { exact: true })).toBeVisible()
    await expect
      .poll(() => previewPane.evaluate((element) => element.scrollTop), {
        message: "Preview-only mode should restore the public header origin",
      })
      .toBeLessThanOrEqual(1)
  })

  test("preview mode keeps the public reading padding of the full public preview", async ({ page }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")

    await page.getByRole("tab", { name: "Preview" }).click()
    await expect(page.getByTestId("markdown-editor-write-pane")).toHaveCount(0)

    const previewOnlyContract = await page
      .getByTestId("markdown-editor-preview-pane")
      .locator("article")
      .evaluate((article) => {
        const style = window.getComputedStyle(article)
        return {
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
        }
      })

    expect(previewOnlyContract.paddingTop).toBe("48px")
    expect(previewOnlyContract.paddingRight).toBe("44px")
    expect(previewOnlyContract.paddingBottom).toBe("110px")
    expect(previewOnlyContract.paddingLeft).toBe("44px")
  })

  test("dedicated editor exposes V4 full-screen chrome around the editor", async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1152 })
    await routeAuthenticatedEditor(page, "본문이 없습니다.")

    await page.goto("/editor/new?source=local-draft")

    const editor = page.getByTestId("markdown-editor")
    const exitButton = page.getByRole("button", { name: "← 글 관리" })
    const guideButton = page.getByRole("button", { name: "Markdown 가이드" })
    const publishButton = page.getByRole("button", { name: "발행 설정" }).first()
    await expect(editor).toBeVisible()
    await expect(exitButton).toBeVisible()
    await expect(guideButton).toBeVisible()
    await expect(publishButton).toBeVisible()
    await expect(page.getByRole("heading", { name: "Document outline" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Publish inspector" })).toBeVisible()
    await expect(page.getByLabel("Summary")).toHaveAttribute("maxLength", "150")
    await page.getByLabel("Category").fill("개발")
    await page.getByLabel("Category").blur()
    await expect(page.getByLabel("Category")).toHaveValue("개발")
    await expect
      .poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), categoryCatalogStorageKey))
      .toBe(JSON.stringify(["folder::개발"]))
    await page.getByRole("button", { name: "카테고리 지우기" }).click()
    await expect(page.getByLabel("Category")).toHaveValue("")

    await page.getByLabel("Summary").fill("x".repeat(200))
    await expect(page.getByLabel("Summary")).toHaveValue("x".repeat(150))

    await page.getByPlaceholder("제목을 입력하세요").fill("")
    await page.getByLabel("Markdown 본문").fill("")
    await page.getByLabel("Summary").fill("")
    await expect(page.locator('aside[aria-label="발행 설정"] b[data-tone="warn"]')).toHaveCount(2)

    const editorBox = await editor.boundingBox()
    const exitBox = await exitButton.boundingBox()
    const publishBox = await publishButton.boundingBox()
    expect(editorBox).not.toBeNull()
    expect(exitBox).not.toBeNull()
    expect(publishBox).not.toBeNull()
    if (!editorBox || !exitBox || !publishBox) return

    expect(exitBox.y).toBeLessThan(editorBox.y)
    expect(publishBox.y).toBeLessThan(editorBox.y)
  })

  test("keeps a dismissed local draft candidate in storage and offers it again after reload", async ({ page }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new")
    const restoreSuggestion = page.getByRole("status").filter({ hasText: "브라우저 임시글이 있습니다." })
    await expect(restoreSuggestion).toBeVisible()
    await restoreSuggestion.getByRole("button", { name: "이번 세션에 표시 안 함" }).click()
    await expect(restoreSuggestion).toHaveCount(0)
    await expect
      .poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), localDraftStorageKey))
      .toContain("Markdown 작성 테스트")

    await page.reload()
    await expect(restoreSuggestion).toBeVisible()
    await restoreSuggestion.getByRole("button", { name: "삭제" }).click()
    await expect
      .poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), localDraftStorageKey))
      .toBeNull()
  })

  test("dedicated editor outline hides inline markdown markers from headings", async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1152 })
    await routeAuthenticatedEditor(
      page,
      [
        "## **시작하며**",
        "",
        "### `핵심` 포인트",
        "",
        "### `**kwargs**`",
        "",
        "## _기울임_",
        "",
        "## __굵게__",
        "",
        "## user_id_field",
        "",
        "## 프로젝트_설정_가이드",
      ].join("\n"),
      "Using **kwargs** in Python"
    )

    await page.goto("/editor/new?source=local-draft")

    const outline = page.getByLabel("문서 목차")
    await expect(outline.locator("strong").filter({ hasText: /^Using \*\*kwargs\*\* in Python$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^시작하며$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^핵심 포인트$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^\*\*kwargs\*\*$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^기울임$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^굵게$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^user_id_field$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^프로젝트_설정_가이드$/ })).toBeVisible()
    await expect(outline.locator("strong").filter({ hasText: /^\*\*시작하며\*\*$/ })).toHaveCount(0)
    await expect(outline.locator("strong").filter({ hasText: /^`핵심` 포인트$/ })).toHaveCount(0)
    await expect(outline.locator("strong").filter({ hasText: /^_기울임_$/ })).toHaveCount(0)
    await expect(outline.locator("strong").filter({ hasText: /^__굵게__$/ })).toHaveCount(0)
  })

  test("heading outline navigation and shared reading statistics parity", async ({ page }) => {
    const title = "목차 이동과 통계"
    const content = [
      "## 중복 heading",
      "",
      "가".repeat(900),
      "",
      "#### 중복 heading",
      "",
      "한글 유니코드 본문",
    ].join("\n")
    const previewId = "outline-statistics"

    await page.setViewportSize({ width: 2048, height: 1152 })
    await routeAuthenticatedEditor(page, content, title)
    await page.goto("/editor/new?source=local-draft")

    const outline = page.getByLabel("문서 목차")
    const titleInput = page.getByPlaceholder("제목을 입력하세요")
    const textarea = page.getByLabel("Markdown 본문")
    await outline.getByRole("button", { name: title }).click()
    await expect(titleInput).toBeFocused()

    const fourthLevelHeading = outline.getByRole("button", { name: "중복 heading" }).nth(1)
    await fourthLevelHeading.focus()
    await page.keyboard.press("Enter")
    const headingStart = content.indexOf("#### 중복 heading")
    await expect(textarea).toBeFocused()
    await expect
      .poll(() => textarea.evaluate((node) => ({ start: node.selectionStart, end: node.selectionEnd })))
      .toEqual({ start: headingStart, end: headingStart + "#### 중복 heading".length })

    await outline.getByRole("button", { name: "중복 heading" }).first().focus()
    await page.keyboard.press("Space")
    const secondLevelStart = content.indexOf("## 중복 heading")
    await expect
      .poll(() => textarea.evaluate((node) => ({ start: node.selectionStart, end: node.selectionEnd })))
      .toEqual({ start: secondLevelStart, end: secondLevelStart + "## 중복 heading".length })
    await expect(page.getByLabel("발행 설정").getByText(/2분/)).toBeVisible()

    await page.addInitScript(
      ({ content, previewId, title }) => {
        window.localStorage.setItem(
          `editor.actual-preview.v1:${previewId}`,
          JSON.stringify({
            id: previewId,
            title,
            content,
            summary: "",
            summarySource: "NONE",
            tags: [],
            visibility: "PUBLIC_LISTED",
            thumbnailUrl: "",
            authorName: "aquila",
            authorImageUrl: "",
            createdAt: "2026-08-24T00:00:00.000Z",
          })
        )
      },
      { content, previewId, title }
    )
    await page.goto(`/editor/preview/${previewId}`)
    await expect(page.getByText("2분 READ", { exact: true })).toBeVisible()
    await expect(page.getByText(/VIEWS/)).toHaveCount(0)
  })

  test("preview matches supported table markdown for alignment, escaped pipes, and inline cell formatting", async ({
    page,
  }) => {
    await routeAuthenticatedEditor(
      page,
      [
        "# Table parity",
        "",
        "```md",
        "| example | only |",
        "| --- | --- |",
        "| this is code | not a rendered table |",
        "```",
        "",
        "    | indented | code |",
        "    | --- | --- |",
        "",
        "escaped \\| pipe is plain text",
        "--- | ---",
        "",
        "Mismatch | Header | Count",
        "--- | ---",
        "one | two",
        "",
        "Inline | `pipe|code`",
        "--- | ---",
        "",
        "Two dash A | Two dash B",
        "-- | --",
        "one | two",
        "",
        "Left | Center | Right",
        ":--- | :---: | ---:",
        "**strong** and *em* | `code` and [link](https://github.com) | escaped \\| pipe",
        "",
        '<!-- aq-table {"overflowMode":"wide","columnWidths":[320,360,420]} -->',
        "| Wide A | Wide B | Wide C |",
        "| --- | --- | --- |",
        "| " + "wide content ".repeat(10) + " | beta | gamma |",
      ].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const preview = page.getByTestId("markdown-editor-preview-pane")
    await expect(preview.locator("pre").filter({ hasText: "| example | only |" })).toBeVisible()
    await expect(preview.locator("pre").filter({ hasText: "| indented | code |" })).toBeVisible()
    await expect(preview.getByText("escaped | pipe is plain text")).toBeVisible()
    await expect(preview.getByText("Mismatch | Header | Count")).toBeVisible()
    await expect(preview.getByText("Inline | pipe|code")).toBeVisible()
    await expect(preview.locator("table")).toHaveCount(3)

    const table = preview.locator("table").filter({ hasText: "strong" }).first()
    await expect(table).toBeVisible()
    await expect(table.locator("th")).toHaveCount(3)
    await expect(table.locator("td")).toHaveCount(3)
    await expect(table.locator("td").nth(0).locator("strong")).toHaveText("strong")
    await expect(table.locator("td").nth(0).locator("em")).toHaveText("em")
    await expect(table.locator("td").nth(1).locator("code")).toHaveText("code")
    await expect(table.locator("td").nth(1).locator("a")).toHaveAttribute("href", "https://github.com")
    await expect(table.locator("td").nth(2)).toHaveText("escaped | pipe")

    const tableContract = await table.evaluate((element) => {
      const cells = Array.from(element.querySelectorAll<HTMLElement>("th"))
      const shell = element.closest(".aq-table-shell")
      const scroll = element.closest(".aq-table-scroll")
      return {
        alignments: cells.map((cell) => window.getComputedStyle(cell).textAlign),
        shellWidth: shell?.getBoundingClientRect().width ?? 0,
        tableWidth: element.getBoundingClientRect().width,
        scrollWidth: scroll?.scrollWidth ?? 0,
        clientWidth: scroll?.clientWidth ?? 0,
      }
    })

    expect(tableContract.alignments).toEqual(["left", "center", "right"])
    expect(tableContract.clientWidth).toBeLessThanOrEqual(tableContract.shellWidth + 1)
    expect(tableContract.tableWidth).toBeLessThanOrEqual(tableContract.scrollWidth + 1)

    const wideTableContract = await preview
      .locator("table")
      .filter({ hasText: "wide content" })
      .first()
      .evaluate((element) => {
        const scroll = element.closest(".aq-table-scroll")
        return {
          mode: element.getAttribute("data-overflow-mode"),
          scrollWidth: scroll?.scrollWidth ?? 0,
          clientWidth: scroll?.clientWidth ?? 0,
        }
      })

    expect(wideTableContract.mode).toBe("wide")
    expect(wideTableContract.scrollWidth).toBeGreaterThan(wideTableContract.clientWidth)
  })

  test("write pane uses the V4 dark markdown source surface", async ({ page }) => {
    await routeAuthenticatedEditor(
      page,
      [
        "# Token Highlight",
        "",
        "[link](https://example.com) and `inline code`",
        "",
        "> quoted text",
      ].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const styles = await page.getByTestId("markdown-editor-write-pane").evaluate((pane) => {
      const gutterTestId = ["markdown", "editor", "line", "number", "gutter"].join("-")
      const readStyle = (selector: string) => {
        const element = pane.querySelector(selector)
        if (!element) throw new Error(`${selector} not found`)
        const style = window.getComputedStyle(element)
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
        }
      }

      return {
        frame: readStyle("[data-testid='markdown-textarea-frame']"),
        textarea: readStyle("textarea"),
        gutterCount: pane.querySelectorAll(`[data-testid='${gutterTestId}']`).length,
      }
    })

    expect(styles.frame.backgroundColor).toBe("rgb(15, 23, 40)")
    expect(styles.textarea.backgroundColor).toBe(styles.frame.backgroundColor)
    expect(styles.gutterCount).toBe(0)
    expect(styles.textarea.color).toBe("rgb(217, 228, 247)")
  })

  test("write pane focus does not render the global blue textarea outline", async ({ page }) => {
    await routeAuthenticatedEditor(
      page,
      [
        "### Stateful",
        "",
        "Markdown textarea focus should keep the writing surface visually stable.",
      ].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await expect(textarea).toBeVisible()
    // Playwright click() synthesizes :focus-visible; use focusVisible:false for mouse contract.
    const mouseFocusContract = await textarea.evaluate((element) => {
      element.focus({ focusVisible: false })
      const style = window.getComputedStyle(element)
      return {
        active: document.activeElement === element,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    })

    expect(mouseFocusContract.active).toBe(true)
    expect(mouseFocusContract.outlineStyle).toBe("none")
    expect(mouseFocusContract.outlineWidth).toBe("0px")
    expect(mouseFocusContract.outlineColor).not.toBe("rgb(63, 81, 181)")

    const keyboardFocusContract = await textarea.evaluate((element) => {
      element.blur()
      element.focus({ focusVisible: true })
      const style = window.getComputedStyle(element)
      return {
        active: document.activeElement === element,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    })
    expect(keyboardFocusContract.active).toBe(true)
    expect(keyboardFocusContract.outlineStyle).toBe("solid")
    expect(keyboardFocusContract.outlineWidth).not.toBe("0px")
  })

  test("write pane supports native mouse drag text selection", async ({ page }) => {
    await routeAuthenticatedEditor(
      page,
      [
        "# Drag Selection",
        "",
        "마우스 드래그로 이 문장을 선택할 수 있어야 합니다.",
        "선택이 풀리거나 preview pane으로 focus가 튀면 안 됩니다.",
      ].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    await expect(writePane).toBeVisible()
    const textarea = writePane.locator("textarea")
    await expect(textarea).toBeVisible()

    const textareaBox = await textarea.boundingBox()
    expect(textareaBox).not.toBeNull()
    if (!textareaBox) return

    const dragMetrics = await textarea.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        lineHeight: Number.parseFloat(style.lineHeight),
        paddingTop: Number.parseFloat(style.paddingTop),
        paddingLeft: Number.parseFloat(style.paddingLeft),
      }
    })
    const targetY = textareaBox.y + dragMetrics.paddingTop + dragMetrics.lineHeight * 2 + dragMetrics.lineHeight / 2

    await page.mouse.move(textareaBox.x + dragMetrics.paddingLeft, targetY)
    await page.mouse.down()
    await page.mouse.move(textareaBox.x + dragMetrics.paddingLeft + 330, targetY, {
      steps: 12,
    })
    await page.mouse.up()

    const selectionState = await textarea.evaluate((element) => {
      return {
        selectedText: element.value.slice(element.selectionStart, element.selectionEnd),
        selectionStart: element.selectionStart,
        selectionEnd: element.selectionEnd,
        activeInsideWritePane: document.activeElement === element,
      }
    })

    expect(selectionState.selectionEnd).toBeGreaterThan(selectionState.selectionStart)
    expect(selectionState.selectedText).toContain("드래그")
    expect(selectionState.selectedText).toContain("선택")
    expect(selectionState.activeInsideWritePane).toBe(true)
  })

  test("split preview keeps readable width and typography while matching the write start", async ({
    page,
  }) => {
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")

    const previewContract = await page
      .getByTestId("markdown-editor-preview-pane")
      .locator("article")
      .evaluate((article) => {
        const markdownRoot = article.querySelector(".aq-markdown")
        if (!(markdownRoot instanceof HTMLElement)) throw new Error("preview markdown root not found")
        const articleStyle = window.getComputedStyle(article)
        const style = window.getComputedStyle(markdownRoot)
        const rect = markdownRoot.getBoundingClientRect()
        return {
          articleBackground: articleStyle.backgroundColor,
          paddingLeft: articleStyle.paddingLeft,
          paddingRight: articleStyle.paddingRight,
          marginTop: style.marginTop,
          maxWidth: style.maxWidth,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          renderedWidth: rect.width,
        }
    })

    expect(previewContract.articleBackground).not.toBe("rgb(13, 17, 23)")
    expect(previewContract.paddingLeft).toBe("32px")
    expect(previewContract.paddingRight).toBe("32px")
    expect(previewContract.marginTop).toBe("0px")
    expect(previewContract.maxWidth).toBe("760px")
    expect(previewContract.fontSize).toBe("17px")
    expect(previewContract.lineHeight).toBe("28px")
    expect(previewContract.renderedWidth).toBeLessThanOrEqual(760)
  })

  test("narrow split mode keeps the write pane primary and shows detail preview through the Preview tab", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 760, height: 900 })
    await routeAuthenticatedEditor(page)

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const previewPane = page.getByTestId("markdown-editor-preview-pane")

    await expect(writePane).toBeVisible()
    await expect(previewPane).toBeVisible()

    await page.getByRole("tab", { name: "Preview" }).click()

    await expect(writePane).toHaveCount(0)
    await expect(previewPane).toBeVisible()
    const previewContract = await previewPane.locator(".aq-markdown").evaluate((markdownRoot) => {
      const style = window.getComputedStyle(markdownRoot)
      const rect = markdownRoot.getBoundingClientRect()
      return {
        maxWidth: style.maxWidth,
        renderedWidth: rect.width,
      }
    })

    expect(previewContract.maxWidth).toBe("760px")
    expect(previewContract.renderedWidth).toBeLessThanOrEqual(728)
  })

  test("split panes keep matching headings aligned in both scroll directions", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await routeScrollSyncImage(page)
    await routeAuthenticatedEditor(page, buildScrollSyncMarkdown())

    await page.goto("/editor/new?source=local-draft")

    await expect(page.getByTestId("markdown-editor-write-pane").locator("textarea")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()
    await expect(
      page.getByTestId("markdown-editor-preview-pane").getByRole("heading", { name: "Section 64", exact: true })
    ).toBeAttached()

    await expectBidirectionalHeadingAlignment(page)
  })

  test("split panes keep matching headings aligned on the 1440x900 desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await routeScrollSyncImage(page)
    await routeAuthenticatedEditor(page, buildScrollSyncMarkdown())

    await page.goto("/editor/new?source=local-draft")

    await expect(page.getByTestId("markdown-editor-write-pane").locator("textarea")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()

    await expectBidirectionalHeadingAlignment(page)
  })

  test("1024px stacked split keeps the write and preview body baseline aligned", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await routeAuthenticatedEditor(page, "ㄷㄷㄷ")

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const previewPane = page.getByTestId("markdown-editor-preview-pane")
    await expect(writePane.locator("textarea")).toBeVisible()
    await expect(previewPane.getByText("ㄷㄷㄷ")).toBeVisible()
    await expect(previewPane.getByText("Public preview", { exact: true })).toBeHidden()

    const readStackedContract = () =>
      page.evaluate(() => {
        const writePane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-write-pane']")
        const previewPane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-preview-pane']")
        const textarea = writePane?.querySelector<HTMLTextAreaElement>("textarea")
        const firstPreviewBlock = previewPane?.querySelector<HTMLElement>(".aq-markdown > :first-child")
        if (!writePane || !previewPane || !textarea || !firstPreviewBlock) {
          throw new Error("markdown split pane elements not found")
        }

        const writePaneRect = writePane.getBoundingClientRect()
        const previewPaneRect = previewPane.getBoundingClientRect()
        const textareaRect = textarea.getBoundingClientRect()
        const textareaStyle = window.getComputedStyle(textarea)
        const firstPreviewBlockRect = firstPreviewBlock.getBoundingClientRect()

        return {
          stacked: previewPaneRect.top >= writePaneRect.bottom - 1,
          writeStartLeft: textareaRect.left + Number.parseFloat(textareaStyle.paddingLeft) - writePaneRect.left,
          writeStartTop: textareaRect.top + Number.parseFloat(textareaStyle.paddingTop) - writePaneRect.top,
          previewStartLeft: firstPreviewBlockRect.left - previewPaneRect.left,
          previewStartTop: firstPreviewBlockRect.top - previewPaneRect.top,
        }
      })

    await expect
      .poll(async () => {
        const contract = await readStackedContract()
        return Math.abs(contract.writeStartTop - contract.previewStartTop)
      }, { message: "stacked split preview body should start with the Markdown source body" })
      .toBeLessThanOrEqual(12)

    const stackedContract = await readStackedContract()
    expect(stackedContract.stacked).toBe(true)
    // 가로 시작점은 preview의 760px readable width 정책(#792)에 따라 stacked 레이아웃에서 가운데 정렬된다.
    // 이 이슈의 계약은 세로 본문 기준선이므로 pane 안에 본문이 들어오는지만 확인한다.
    expect(stackedContract.previewStartLeft).toBeGreaterThanOrEqual(stackedContract.writeStartLeft)
  })

  test("/editor/[id] split keeps matching headings aligned in both scroll directions", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await routeScrollSyncImage(page)
    await routeAuthenticatedEditor(page)
    await routeEditorPost(page, 770, buildScrollSyncMarkdown())

    await page.goto("/editor/770")

    await expect(page.getByTestId("markdown-editor-write-pane").locator("textarea")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()
    await expect(
      page.getByTestId("markdown-editor-preview-pane").getByRole("heading", { name: "Section 64", exact: true })
    ).toBeAttached()

    await expectBidirectionalHeadingAlignment(page)
  })

  test("split scroll sync survives same-length heading edits", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await routeAuthenticatedEditor(page, buildScrollSyncMarkdown(32))

    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await expect(textarea).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()

    await scrollWriteToSection(page, 24)
    await expect
      .poll(() => readSectionAlignmentError(page, 24), {
        message: "preview should align the same heading before the rename",
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)

    // 길이가 같은 heading으로 바꾸면 preview의 문자 수·heading 수·렌더 높이가 그대로라
    // content revision 없이는 preview anchor cache가 옛 key를 계속 사용한다.
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const nextValue = element.value.replace(/## Section /g, "## Sectiom ")
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
      if (!setValue) throw new Error("textarea value setter not found")
      setValue.call(element, nextValue)
      element.dispatchEvent(new Event("input", { bubbles: true }))
    })

    await expect(
      page.getByTestId("markdown-editor-preview-pane").getByRole("heading", { name: "Sectiom 24", exact: true })
    ).toBeAttached()

    await scrollWriteToSection(page, 24, "Sectiom")
    await expect
      .poll(() => readSectionAlignmentError(page, 24, "Sectiom"), {
        message: "preview anchors should be rebuilt after a same-length heading edit",
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)
  })

  test("split scroll sync measures wrapped source lines with the textarea content width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const wrappedBody = "wrapmeasure".repeat(82)
    const wrappedMarkdown = Array.from({ length: 24 }, (_, index) => [
      `## Section ${index + 1}`,
      "",
      wrappedBody,
      "",
    ].join("\n")).join("\n")

    await routeAuthenticatedEditor(page, wrappedMarkdown)

    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await expect(textarea).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()

    const wrapMetrics = await textarea.evaluate((element: HTMLTextAreaElement) => {
      const style = window.getComputedStyle(element)
      const probe = document.createElement("span")
      Object.assign(probe.style, {
        position: "fixed",
        left: "-100000px",
        top: "0",
        whiteSpace: "pre",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        letterSpacing: style.letterSpacing,
      })
      probe.textContent = "w".repeat(200)
      document.body.append(probe)
      const characterWidth = probe.getBoundingClientRect().width / 200
      probe.remove()

      const contentWidth =
        element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      const charactersPerLine = Math.floor(contentWidth / characterWidth)
      const lineHeight = Number.parseFloat(style.lineHeight)
      const visualLines = element.value
        .split("\n")
        .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0)

      return {
        longestLineLength: element.value.split("\n").reduce((longest, line) => Math.max(longest, line.length), 0),
        charactersPerLine,
        lineHeight,
        predictedScrollHeight:
          Number.parseFloat(style.paddingTop) + visualLines * lineHeight + Number.parseFloat(style.paddingBottom),
        actualScrollHeight: element.scrollHeight,
      }
    })

    // fixture가 실제로 줄바꿈되는지, 그리고 ground truth 계산이 브라우저 레이아웃과 맞는지 먼저 고정한다.
    expect(wrapMetrics.charactersPerLine).toBeLessThan(wrapMetrics.longestLineLength)
    expect(Math.abs(wrapMetrics.predictedScrollHeight - wrapMetrics.actualScrollHeight)).toBeLessThanOrEqual(
      wrapMetrics.lineHeight
    )

    const readWrappedAlignmentError = (section: number) =>
      page.evaluate(({ targetSection, charactersPerLine }) => {
        const writePane = document.querySelector<HTMLElement>("[data-testid='markdown-editor-write-pane']")
        const textareaElement = writePane?.querySelector<HTMLTextAreaElement>("textarea")
        const preview = document.querySelector<HTMLElement>("[data-testid='markdown-editor-preview-pane']")
        if (!writePane || !textareaElement || !preview) throw new Error("split pane elements not found")

        const marker = `## Section ${targetSection}\n`
        const markerIndex = textareaElement.value.indexOf(marker)
        if (markerIndex < 0) throw new Error(`${marker.trim()} source marker not found`)

        const style = window.getComputedStyle(textareaElement)
        const lineHeight = Number.parseFloat(style.lineHeight)
        const visualLineIndex = textareaElement.value
          .slice(0, markerIndex)
          .split("\n")
          .slice(0, -1)
          .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0)
        const writeHeadingTop =
          textareaElement.getBoundingClientRect().top -
          writePane.getBoundingClientRect().top +
          Number.parseFloat(style.paddingTop) +
          visualLineIndex * lineHeight -
          textareaElement.scrollTop

        const previewHeading = Array.from(preview.querySelectorAll<HTMLElement>(".aq-markdown h2")).find(
          (candidate) => candidate.textContent?.trim() === `Section ${targetSection}`
        )
        if (!previewHeading) throw new Error(`Section ${targetSection} preview heading not found`)

        return Math.abs(
          writeHeadingTop - (previewHeading.getBoundingClientRect().top - preview.getBoundingClientRect().top)
        )
      }, { targetSection: section, charactersPerLine: wrapMetrics.charactersPerLine })

    const scrollWriteToWrappedSection = (section: number) =>
      page.evaluate(({ targetSection, charactersPerLine }) => {
        const element = document.querySelector<HTMLTextAreaElement>(
          "[data-testid='markdown-editor-write-pane'] textarea"
        )
        if (!element) throw new Error("write textarea not found")

        const marker = `## Section ${targetSection}\n`
        const markerIndex = element.value.indexOf(marker)
        if (markerIndex < 0) throw new Error(`${marker.trim()} source marker not found`)

        const style = window.getComputedStyle(element)
        const lineHeight = Number.parseFloat(style.lineHeight)
        const visualLineIndex = element.value
          .slice(0, markerIndex)
          .split("\n")
          .slice(0, -1)
          .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0)
        const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
        element.scrollTop = Math.max(
          0,
          Math.min(
            Number.parseFloat(style.paddingTop) + visualLineIndex * lineHeight - element.clientHeight * 0.25,
            maxScrollTop
          )
        )
        element.dispatchEvent(new Event("scroll", { bubbles: true }))
      }, { targetSection: section, charactersPerLine: wrapMetrics.charactersPerLine })

    for (const section of [8, 16, 24]) {
      await scrollWriteToWrappedSection(section)
      await expect
        .poll(() => readWrappedAlignmentError(section), {
          message: `wrapped Section ${section} should align with the same preview heading`,
        })
        .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)
    }
  })

  test("split scroll sync realigns after asynchronous preview layout changes", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await routeAuthenticatedEditor(page, buildScrollSyncMarkdown(48))

    await page.goto("/editor/new?source=local-draft")

    await expect(page.getByTestId("markdown-editor-write-pane").locator("textarea")).toBeVisible()
    await expect(page.getByTestId("markdown-editor-preview-pane")).toBeVisible()

    await scrollWriteToSection(page, 32)
    await expect
      .poll(() => readSectionAlignmentError(page, 32), {
        message: "preview should align the same heading before the async layout change",
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)

    // 이미지 load·Mermaid 렌더처럼 스크롤 없이 preview 높이만 바뀌는 상황을 재현한다.
    await page.addStyleTag({
      content: "[data-testid='markdown-editor-preview-pane'] .aq-markdown h2 { margin-top: 140px; }",
    })

    await expect
      .poll(() => readSectionAlignmentError(page, 32), {
        message: "preview should realign after a layout change without any scroll event",
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)

    await page.setViewportSize({ width: 1440, height: 900 })

    await expect
      .poll(() => readSectionAlignmentError(page, 32), {
        message: "preview should realign after a viewport resize without any scroll event",
      })
      .toBeLessThanOrEqual(scrollSyncAlignmentTolerancePx)
  })

  test("분할 미리보기 wheel은 내부 스크롤 가능 구간에서 미리보기를 먼저 스크롤한다", async ({ page }) => {
    const longMarkdown = Array.from({ length: 32 }, (_, index) => [
      `## Section ${index + 1}`,
      "",
      `preview 내부 wheel 스크롤이 먼저 동작해야 합니다. paragraph ${index + 1}`,
      "",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      `| Value ${index + 1} | Result ${index + 1} |`,
      "",
    ].join("\n")).join("\n")

    await routeAuthenticatedEditor(page, longMarkdown)

    await page.goto("/editor/new?source=local-draft")

    const previewScroll = page.getByTestId("markdown-editor-preview-pane")
    await expect(previewScroll).toBeVisible()
    await previewScroll.evaluate((element) => {
      element.scrollTop = 0
    })

    const box = await previewScroll.boundingBox()
    if (!box) {
      throw new Error("preview scroll metrics are missing before wheel")
    }

    const beforeDocumentScrollTop = await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY)
    await page.mouse.move(box.x + Math.min(box.width / 2, 160), box.y + Math.min(box.height / 2, 160))
    await page.mouse.wheel(0, 420)

    await expect
      .poll(async () => previewScroll.evaluate((element) => element.scrollTop), {
        message: "preview wheel should keep native preview scrolling active before overscroll",
      })
      .toBeGreaterThan(80)
    await expect
      .poll(async () => page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY), {
        message: "window should not scroll while preview can consume the wheel",
      })
      .toBe(beforeDocumentScrollTop)
  })

  test("분할 미리보기 wheel은 끝에서 문서 페이지 스크롤 체인을 유지한다", async ({ page }) => {
    const longMarkdown = Array.from({ length: 24 }, (_, index) => [
      `## Section ${index + 1}`,
      "",
      "```ts",
      `const previewWheelScrollChain${index + 1} = true`,
      "```",
      "",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      `| Value ${index + 1} | Result ${index + 1} |`,
      "",
    ].join("\n")).join("\n")

    await routeAuthenticatedEditor(page, longMarkdown)

    await page.goto("/editor/new?source=local-draft")

    const previewScroll = page.getByTestId("markdown-editor-preview-pane")
    await expect(previewScroll).toBeVisible()
    await previewScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await previewScroll.locator("table").last().scrollIntoViewIfNeeded()

    await page.evaluate(() => {
      if (document.querySelector("[data-testid='markdown-preview-wheel-spacer']")) return
      const spacer = document.createElement("div")
      spacer.setAttribute("data-testid", "markdown-preview-wheel-spacer")
      spacer.style.height = "1600px"
      document.body.appendChild(spacer)
    })

    const box = await previewScroll.locator("table").last().boundingBox()
    if (!box) {
      throw new Error("preview table metrics are missing before wheel")
    }

    await page.mouse.move(box.x + Math.min(box.width / 2, 120), box.y + Math.min(box.height / 2, 40))
    const beforeScrollTop = await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY)
    await page.mouse.wheel(0, 420)

    await expect
      .poll(async () => page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY), {
        message: "preview wheel should keep page scroll chaining active",
      })
      .toBeGreaterThan(beforeScrollTop + 80)
  })

  test("분할 미리보기 wheel은 끝을 넘는 남은 스크롤을 문서로 전달한다", async ({ page }) => {
    const longMarkdown = Array.from({ length: 32 }, (_, index) => [
      `## Section ${index + 1}`,
      "",
      `preview 끝 근처 wheel 잔여량이 문서 스크롤로 전달되어야 합니다. paragraph ${index + 1}`,
      "",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      `| Value ${index + 1} | Result ${index + 1} |`,
      "",
    ].join("\n")).join("\n")

    await routeAuthenticatedEditor(page, longMarkdown)

    await page.goto("/editor/new?source=local-draft")

    const previewScroll = page.getByTestId("markdown-editor-preview-pane")
    await expect(previewScroll).toBeVisible()

    await page.evaluate(() => {
      if (document.querySelector("[data-testid='markdown-preview-wheel-remainder-spacer']")) return
      const spacer = document.createElement("div")
      spacer.setAttribute("data-testid", "markdown-preview-wheel-remainder-spacer")
      spacer.style.height = "1600px"
      document.body.appendChild(spacer)
    })

    const edgeState = await previewScroll.evaluate((element) => {
      const max = element.scrollHeight - element.clientHeight
      element.scrollTop = Math.max(0, max - 10)
      return {
        max,
        top: element.scrollTop,
      }
    })
    expect(edgeState.max).toBeGreaterThan(10)

    const box = await previewScroll.boundingBox()
    if (!box) {
      throw new Error("preview scroll metrics are missing before remainder wheel")
    }

    const beforeDocumentScrollTop = await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY)
    await page.mouse.move(box.x + Math.min(box.width / 2, 160), box.y + Math.min(box.height / 2, 160))
    await page.mouse.wheel(0, 420)

    await expect
      .poll(async () => previewScroll.evaluate((element) => element.scrollTop), {
        message: "preview should clamp to the scroll edge before forwarding wheel remainder",
      })
      .toBeGreaterThanOrEqual(edgeState.max - 1)
    await expect
      .poll(async () => page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY), {
        message: "remaining wheel delta should scroll the document after preview reaches its edge",
      })
      .toBeGreaterThan(beforeDocumentScrollTop + 80)
  })

  test("분할 미리보기 wheel은 라인 단위 delta도 픽셀로 환산해 남은 스크롤을 전달한다", async ({ page }) => {
    const longMarkdown = Array.from({ length: 32 }, (_, index) => [
      `## Section ${index + 1}`,
      "",
      `line delta wheel 잔여량이 문서 스크롤로 전달되어야 합니다. paragraph ${index + 1}`,
      "",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      `| Value ${index + 1} | Result ${index + 1} |`,
      "",
    ].join("\n")).join("\n")

    await routeAuthenticatedEditor(page, longMarkdown)

    await page.goto("/editor/new?source=local-draft")

    const previewScroll = page.getByTestId("markdown-editor-preview-pane")
    await expect(previewScroll).toBeVisible()

    await page.evaluate(() => {
      const win = window as typeof window & { __previewWheelScrollByCalls?: number[] }
      win.__previewWheelScrollByCalls = []
      const originalScrollBy = window.scrollBy.bind(window)
      window.scrollBy = ((options?: ScrollToOptions | number, y?: number) => {
        const top = typeof options === "number" ? y ?? 0 : options?.top ?? 0
        win.__previewWheelScrollByCalls?.push(top)
        if (typeof options === "number") {
          originalScrollBy(options, y ?? 0)
          return
        }
        originalScrollBy(options)
      }) as typeof window.scrollBy
    })

    const eventState = await previewScroll.evaluate((element) => {
      element.style.lineHeight = "24px"
      const max = element.scrollHeight - element.clientHeight
      element.scrollTop = Math.max(0, max - 10)
      const wheelEvent = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaMode: WheelEvent.DOM_DELTA_LINE,
        deltaY: 2,
      })
      element.dispatchEvent(wheelEvent)
      return {
        max,
        top: element.scrollTop,
      }
    })

    expect(eventState.max).toBeGreaterThan(10)
    expect(eventState.top).toBeGreaterThanOrEqual(eventState.max - 1)
    const scrollByCalls = await page.evaluate(() => (window as typeof window & { __previewWheelScrollByCalls?: number[] }).__previewWheelScrollByCalls ?? [])
    expect(scrollByCalls.some((top) => top > 20)).toBe(true)
  })

  test("toolbar snippets insert at the textarea caret instead of appending at the document end", async ({
    page,
  }) => {
    await routeAuthenticatedEditor(page, ["alpha", "omega"].join("\n"))

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    await expect(writePane).toBeVisible()
    await writePane.locator("textarea").click()
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Home" : "Control+Home")
    await page.keyboard.press("ArrowRight")
    await page.getByRole("button", { name: "표 삽입", exact: true }).click()

    const editorText = await writePane.locator("textarea").inputValue()
    const tableMarker = "|  |  |"
    expect(editorText.indexOf(tableMarker)).toBeGreaterThan(-1)
    expect(editorText.indexOf(tableMarker)).toBeLessThan(editorText.indexOf("omega"))
    await expect(page.getByTestId("markdown-editor-preview-pane").locator("table")).toBeVisible()
  })

  test("command registry toolbar menu and keyboard parity", async ({ page }) => {
    const tableMarkdown = ["| A | B |", "| --- | --- |", "| one | two |"].join("\n")
    await routeAuthenticatedEditor(page, tableMarkdown)
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    const commandMenu = page.getByRole("combobox", { name: "명령 메뉴", exact: true })
    await expect(commandMenu).toBeVisible()
    const boldButton = page.getByRole("button", { name: /굵게 \((⌘|Ctrl\+)B\)/ })
    await expect(boldButton).toHaveCount(1)
    await expect(page.getByRole("button", { name: "코드 블록", exact: true })).toHaveCount(1)
    await expect(page.getByRole("button", { name: "표 행 추가", exact: true })).toHaveCount(1)
    await expect(commandMenu.getByRole("option", { name: "표 행 추가", exact: true })).toBeDisabled()

    await textarea.click()
    await textarea.press(process.platform === "darwin" ? "Meta+A" : "Control+A")
    await textarea.press(process.platform === "darwin" ? "Meta+B" : "Control+B")
    await expect(textarea).toHaveValue(`**${tableMarkdown}**`)

    await boldButton.click()
    await expect(textarea).toHaveValue(tableMarkdown)

    await textarea.evaluate((element) => {
      element.focus()
      element.setSelectionRange(element.value.length, element.value.length)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    await textarea.press("Enter")
    await textarea.press(process.platform === "darwin" ? "Meta+B" : "Control+B")
    await expect(textarea).toHaveValue(`${tableMarkdown}\n****`)

    await page.getByRole("tab", { name: "Preview" }).click()
    await commandMenu.selectOption("block.code")
    await expect(page.getByTestId("markdown-editor-write-pane")).toBeVisible()
    await expect.poll(() => textarea.inputValue()).toContain(tableMarkdown)
    await expect.poll(() => textarea.inputValue()).toContain("```\n\n```")

    await textarea.evaluate((element) => {
      const caret = element.value.indexOf("one")
      element.focus()
      element.setSelectionRange(caret, caret)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    await textarea.press("ArrowRight")
    await expect(commandMenu.getByRole("option", { name: "표 행 추가", exact: true })).toBeEnabled()
    const logicalRowCountBeforeAdd = await textarea.evaluate((element) =>
      element.value.split("\n").filter((line) => line.startsWith("|")).length
    )
    await commandMenu.selectOption("table.add-row")
    await expect
      .poll(() =>
        textarea.evaluate((element) => element.value.split("\n").filter((line) => line.startsWith("|")).length)
      )
      .toBe(logicalRowCountBeforeAdd + 1)
  })

  test("ordered list toolbar transforms mixed nested lines with shared undo and redo", async ({ page }) => {
    const original = ["plain", "  - nested", "- [x] task"].join("\n")
    const transformed = ["1. plain", "  1. nested", "2. task"].join("\n")
    await routeAuthenticatedEditor(page, original)
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await textarea.click()
    await textarea.press(process.platform === "darwin" ? "Meta+A" : "Control+A")
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual([0, original.length])
    await page.getByRole("tab", { name: "Preview" }).click()
    await expect(page.getByTestId("markdown-editor-write-pane")).toHaveCount(0)
    await page.getByRole("button", { name: "순서 목록", exact: true }).click()

    await expect(page.getByTestId("markdown-editor-write-pane")).toBeVisible()
    await expect(textarea).toHaveValue(transformed)
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual(["1. ".length, transformed.length])

    await textarea.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z")
    await expect(textarea).toHaveValue(original)
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual([0, original.length])

    await textarea.press(process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z")
    await expect(textarea).toHaveValue(transformed)
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual(["1. ".length, transformed.length])

    const quotedFenced = ["> ```js", "> const alpha = 1", "> ```"].join("\n")
    await textarea.fill(quotedFenced)
    await textarea.evaluate((element, selectionEnd) => {
      element.focus()
      element.setSelectionRange(0, selectionEnd)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    }, quotedFenced.length)
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual([0, quotedFenced.length])
    await page.getByRole("tab", { name: "Preview" }).click()
    await page.getByRole("button", { name: "목록", exact: true }).click()

    await expect(page.getByTestId("markdown-editor-write-pane")).toBeVisible()
    await expect(textarea).toHaveValue(quotedFenced)
    await expect
      .poll(() => textarea.evaluate((element) => [element.selectionStart, element.selectionEnd]))
      .toEqual([0, quotedFenced.length])
  })

  test("bounded table controls insert, edit, navigate, and preview a table", async ({ page }) => {
    await routeAuthenticatedEditor(page, "")
    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const textarea = writePane.locator("textarea")
    await expect(page.getByRole("button", { name: "표 행 추가" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 열 가운데 정렬" })).toBeDisabled()
    await page.getByRole("combobox", { name: "표 행", exact: true }).selectOption("3")
    await page.getByRole("combobox", { name: "표 열", exact: true }).selectOption("3")
    await page.getByRole("button", { name: "표 삽입" }).click()
    const insertedRows = (await textarea.inputValue()).split("\n").filter((line) => line.startsWith("|"))
    expect(insertedRows).toHaveLength(4)
    expect(insertedRows).toEqual([
      "|  |  |  |",
      "| --- | --- | --- |",
      "|  |  |  |",
      "|  |  |  |",
    ])

    await page.getByRole("button", { name: "표 열 가운데 정렬" }).click()
    await page.getByRole("button", { name: "표 행 추가" }).click()
    await textarea.press("Tab")
    await textarea.press("Shift+Tab")
    const logicalRowCountBeforeAppend = await textarea.evaluate((element) => {
      const rows = element.value.split("\n").filter((line) => line.startsWith("|"))
      const lastRow = rows.at(-1)
      if (!lastRow) throw new Error("expected a table body row")
      const lastRowStart = element.value.lastIndexOf(lastRow)
      const lastCell = lastRowStart + lastRow.lastIndexOf("|") - 1
      element.setSelectionRange(lastCell, lastCell)
      element.dispatchEvent(new Event("select", { bubbles: true }))
      return rows.length - 1
    })
    await textarea.press("Tab")
    const logicalRowCountAfterAppend = (await textarea.inputValue()).split("\n").filter((line) => line.startsWith("|")).length - 1
    expect(logicalRowCountAfterAppend).toBe(logicalRowCountBeforeAppend + 1)
    await expect(textarea).toHaveValue(/\| :---: \| --- \| --- \|/)
    await expect(page.getByTestId("markdown-editor-preview-pane").locator("table")).toBeVisible()
  })

  test("table action buttons reflect edit bounds", async ({ page }) => {
    await routeAuthenticatedEditor(page, "")
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await page.getByRole("combobox", { name: "표 행", exact: true }).selectOption("6")
    await page.getByRole("combobox", { name: "표 열", exact: true }).selectOption("6")
    await page.getByRole("button", { name: "표 삽입" }).click()
    await expect(page.getByRole("button", { name: "표 행 추가" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 열 추가" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 행 삭제" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 열 삭제" })).toBeEnabled()

    const minimumTable = ["| A | B |", "| --- | --- |", "| one | two |"].join("\n")
    await textarea.fill(minimumTable)
    await textarea.evaluate((element) => {
      const caret = element.value.indexOf("one")
      element.setSelectionRange(caret, caret)
    })
    await textarea.press("ArrowRight")
    await expect(page.getByRole("button", { name: "표 행 삭제" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 행 추가" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "표 열 추가" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "표 열 삭제" })).toBeEnabled()

    await page.getByRole("button", { name: "표 열 삭제" }).click()
    await expect(page.getByRole("button", { name: "표 열 삭제" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "표 행 추가" })).toBeEnabled()
  })

  test("literal find and replace preserves selection scope and editor undo", async ({ page }) => {
    const content = ["outside cat", "Cat cat", "outside cat"].join("\n")
    await routeAuthenticatedEditor(page, content)
    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const textarea = writePane.locator("textarea")
    const findReplaceToggle = page.getByRole("button", { name: "찾기 및 바꾸기", exact: true })

    await page.getByRole("tab", { name: "Preview" }).click()
    await expect(findReplaceToggle).toBeDisabled()
    const preview = page.getByTestId("markdown-editor-preview-pane")
    await expect(preview).toContainText("Cat cat")
    await expect(preview).toContainText("outside cat")

    await page.getByRole("tab", { name: "Write" }).click()
    await expect(textarea).toHaveValue(content)
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const selection = "Cat cat"
      const start = element.value.indexOf(selection)
      if (start < 0) throw new Error("selection fixture is missing")
      element.focus()
      element.setSelectionRange(start, start + selection.length)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    await expect(textarea).toHaveJSProperty("selectionStart", content.indexOf("Cat cat"))
    await findReplaceToggle.click()

    const findReplace = page.getByRole("region", { name: "찾기 및 바꾸기" })
    await expect(findReplace).toBeVisible()
    await expect(findReplace).toContainText("선택 영역")
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("Cat cat")

    const query = page.getByRole("textbox", { name: "찾을 내용" })
    const replacement = page.getByRole("textbox", { name: "바꿀 내용" })
    await query.fill("cat")
    await replacement.fill("dog")
    await expect(textarea).toHaveValue(content)

    const status = findReplace.getByRole("status")
    await expect(status).toHaveText(/0\s*\/\s*2/)
    await page.getByRole("checkbox", { name: "대/소문자 구분" }).check()
    await expect(status).toHaveText(/0\s*\/\s*1/)
    await page.getByRole("checkbox", { name: "대/소문자 구분" }).uncheck()
    await expect(status).toHaveText(/0\s*\/\s*2/)

    await page.getByRole("button", { name: "다음 찾기" }).click()
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("Cat")
    await expect(textarea).toBeFocused()
    await page.getByRole("button", { name: "다음 찾기" }).click()
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("cat")
    await page.getByRole("button", { name: "이전 찾기" }).click()
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("Cat")

    await page.getByRole("button", { name: "현재 바꾸기" }).click()
    await expect(textarea).toHaveValue(["outside cat", "dog cat", "outside cat"].join("\n"))
    await page.getByRole("button", { name: "모두 바꾸기" }).click()
    const replaced = ["outside cat", "dog dog", "outside cat"].join("\n")
    await expect(textarea).toHaveValue(replaced)
    await page.getByRole("button", { name: "닫기" }).click()
    await expect(findReplace).toHaveCount(0)

    const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z"
    const redoShortcut = process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z"
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue(["outside cat", "dog cat", "outside cat"].join("\n"))
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("dog")
    await textarea.press(redoShortcut)
    await expect(textarea).toHaveValue(replaced)
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe("dog dog")
    await findReplaceToggle.click()
    await page.getByRole("textbox", { name: "찾을 내용" }).fill("dog")
    await page.getByRole("button", { name: /굵게/ }).click()
    await expect(page.getByRole("textbox", { name: "찾을 내용" })).toBeDisabled()
  })

  test("line commands preserve selection and undo", async ({ page }) => {
    const content = ["first", "second", "third"].join("\n")
    await routeAuthenticatedEditor(page, content)
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    const selectedText = "eco"
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const start = element.value.indexOf("eco")
      if (start < 0) throw new Error("line command fixture is missing")
      element.focus()
      element.setSelectionRange(start, start + "eco".length)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })

    await textarea.evaluate((element) => {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "ArrowDown",
          altKey: true,
          isComposing: true,
        })
      )
    })
    await expect(textarea).toHaveValue(content)

    await page.getByRole("tab", { name: "Preview" }).click()
    await page.keyboard.press("Alt+ArrowDown")
    await expect(textarea).toHaveCount(0)
    await page.getByRole("tab", { name: "Write" }).click()
    await expect(textarea).toHaveValue(content)

    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const start = element.value.indexOf("eco")
      if (start < 0) throw new Error("line command fixture is missing after Preview")
      element.focus()
      element.setSelectionRange(start, start + "eco".length)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })

    await textarea.press("Alt+ArrowDown")
    await expect(textarea).toHaveValue(["first", "third", "second"].join("\n"))
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(
      selectedText
    )

    await textarea.press("Alt+Shift+ArrowDown")
    await expect(textarea).toHaveValue(["first", "third", "second", "second"].join("\n"))
    expect(await textarea.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(
      selectedText
    )

    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const caret = element.value.lastIndexOf("second") + 2
      element.focus()
      element.setSelectionRange(caret, caret)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    const duplicateCaret = await textarea.evaluate((element) => element.selectionStart)
    await textarea.press(process.platform === "darwin" ? "Meta+Shift+k" : "Control+Shift+k")
    const afterDelete = ["first", "third", "second"].join("\n")
    await expect(textarea).toHaveValue(afterDelete)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([
      afterDelete.length,
      afterDelete.length,
    ])

    const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z"
    const redoShortcut = process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z"
    const findReplaceToggle = page.getByRole("button", { name: "찾기 및 바꾸기", exact: true })
    await findReplaceToggle.click()
    await expect(page.getByRole("region", { name: "찾기 및 바꾸기" })).toBeVisible()
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue(["first", "third", "second", "second"].join("\n"))
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([
      duplicateCaret,
      duplicateCaret,
    ])
    await expect(page.getByRole("region", { name: "찾기 및 바꾸기" })).toHaveCount(0)
    await textarea.press(redoShortcut)
    await expect(textarea).toHaveValue(afterDelete)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([
      afterDelete.length,
      afterDelete.length,
    ])

    await textarea.press("x")
    await expect(textarea).toHaveValue(`${afterDelete}x`)
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue(afterDelete)

    await textarea.fill("only")
    await textarea.press(process.platform === "darwin" ? "Meta+Shift+k" : "Control+Shift+k")
    await expect(textarea).toHaveValue("")
    await textarea.press(process.platform === "darwin" ? "Meta+Shift+k" : "Control+Shift+k")
    await expect(textarea).toHaveValue("")
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue("only")
  })

  test("auto pair preserves selection, shared undo, and IME/fence boundaries", async ({ page }) => {
    const content = ["word", "```ts", "const value = ", "```"].join("\n")
    await routeAuthenticatedEditor(page, content)
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus()
      element.setSelectionRange(0, 4)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    await textarea.press("[")
    const paired = ["[word]", "```ts", "const value = ", "```"].join("\n")
    await expect(textarea).toHaveValue(paired)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([1, 5])

    const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z"
    const redoShortcut = process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z"
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue(content)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([0, 4])
    await textarea.press(redoShortcut)
    await expect(textarea).toHaveValue(paired)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([1, 5])

    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const caret = element.value.indexOf("const value = ") + "const value = ".length
      element.focus()
      element.setSelectionRange(caret, caret)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    await textarea.press("(")
    await expect(textarea).toHaveValue(["[word]", "```ts", "const value = (", "```"].join("\n"))

    const composingResult = await textarea.evaluate((element) => {
      const before = element.value
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "(",
        isComposing: true,
      })
      element.dispatchEvent(event)
      return { defaultPrevented: event.defaultPrevented, value: element.value, before }
    })
    expect(composingResult.defaultPrevented).toBe(false)
    expect(composingResult.value).toBe(composingResult.before)
  })

  test("safe HTML paste replaces selection, preserves undo, and rejects active-only HTML", async ({ page }) => {
    const source = "prefix target suffix"
    const html = [
      "<h2>Heading</h2>",
      '<p>safe <strong>bold</strong> <a href="https://example.com/docs">docs</a> <a href="javascript:alert(1)">bad</a> <code>a`b</code></p>',
      "<div>Hello <strong>world</strong>!</div>",
      "<pre>line 1\nline 2</pre>",
      "<p><strong>bold </strong><em>soft </em><s>gone </s>tail</p>",
      "<ul><li>parent<ul><li>child</li></ul></li><li><div>one</div><div>two</div></li></ul>",
      "<script>window.__htmlPasteActive = true</script>",
    ].join("")
    const imported = [
      "## Heading",
      "",
      "safe **bold** [docs](https://example.com/docs) bad ``a`b``",
      "",
      "Hello **world**\\!",
      "",
      "line 1 line 2",
      "",
      "**bold** *soft* ~~gone~~ tail",
      "",
      "- parent",
      "  - child",
      "- one",
      "",
      "  two",
    ].join("\n")
    await routeAuthenticatedEditor(page, source)
    await page.goto("/editor/new?source=local-draft")

    const textarea = page.getByTestId("markdown-editor-write-pane").locator("textarea")
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      const start = element.value.indexOf("target")
      element.focus()
      element.setSelectionRange(start, start + "target".length)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    const paste = async (htmlValue: string, plainText: string) =>
      textarea.evaluate((element, payload) => {
        const clipboard = new DataTransfer()
        clipboard.setData("text/html", payload.htmlValue)
        clipboard.setData("text/plain", payload.plainText)
        const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard })
        element.dispatchEvent(event)
        return event.defaultPrevented
      }, { htmlValue, plainText })

    expect(await paste(html, "https://plain.example.test/fallback")).toBe(true)
    const expected = `prefix ${imported} suffix`
    await expect(textarea).toHaveValue(expected)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([
      "prefix ".length + imported.length,
      "prefix ".length + imported.length,
    ])
    await expect(page.getByTestId("markdown-editor-preview-pane").locator("script")).toHaveCount(0)
    expect(await page.evaluate(() => Boolean((window as unknown as { __htmlPasteActive?: boolean }).__htmlPasteActive))).toBe(false)
    expect(await textarea.inputValue()).not.toContain("javascript:")
    expect(await textarea.inputValue()).not.toContain("plain.example.test")

    const undoShortcut = process.platform === "darwin" ? "Meta+z" : "Control+z"
    const redoShortcut = process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z"
    await textarea.press(undoShortcut)
    await expect(textarea).toHaveValue(source)
    expect(await textarea.evaluate((element) => [element.selectionStart, element.selectionEnd])).toEqual([7, 13])
    await textarea.press(redoShortcut)
    await expect(textarea).toHaveValue(expected)

    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    await textarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus()
      element.setSelectionRange(0, 6)
      element.dispatchEvent(new Event("select", { bubbles: true }))
    })
    expect(await paste("<script>window.__htmlPasteActive = true</script>", "benign plain fallback")).toBe(true)
    await expect(textarea).toHaveValue(expected)
    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toHaveText(
      "붙여넣을 수 있는 안전한 HTML 내용이 없습니다."
    )
  })

  test("image upload inserts a url-only upload response at the textarea caret", async ({ page }) => {
    await routeAuthenticatedEditor(page, ["alpha", "omega"].join("\n"))
    let uploadCalled = false
    await page.route("**/post/api/v1/posts/images", async (route) => {
      uploadCalled = true
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "이미지가 업로드되었습니다.",
        data: {
          key: "posts/body-image.png",
          url: "http://127.0.0.1:3000/post/api/v1/images/posts/body-image.png",
        },
      })
    })

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const textarea = writePane.locator("textarea")
    await expect(textarea).toBeVisible()
    await textarea.click()
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Home" : "Control+Home")
    await page.keyboard.press("ArrowRight")

    await page
      .getByTestId("markdown-editor")
      .locator("input[type='file'][accept='image/*']")
      .setInputFiles({
        name: "본문 이미지.png",
        mimeType: "image/png",
        buffer: onePixelPng,
      })

    await expect.poll(() => uploadCalled, { message: "post image upload request should be sent" }).toBe(true)
    await expect(page.getByText("이미지 업로드에 실패했습니다.")).toHaveCount(0)
    await expect(page.getByText(/이미지 업로드 실패:/)).toHaveCount(0)

    const editorText = await textarea.inputValue()
    const imageMarkdown = "![본문 이미지.png](http://127.0.0.1:3000/post/api/v1/images/posts/body-image.png)"
    expect(editorText).toContain(imageMarkdown)
    expect(editorText.indexOf(imageMarkdown)).toBeLessThan(editorText.indexOf("omega"))
    await expect(page.getByTestId("markdown-editor-preview-pane").locator("img")).toHaveAttribute(
      "src",
      "http://127.0.0.1:3000/post/api/v1/images/posts/body-image.png"
    )
  })

  test("file attachment upload inserts a markdown link at the textarea caret", async ({ page }) => {
    await routeAuthenticatedEditor(page, ["alpha", "omega"].join("\n"))
    let uploadCalled = false
    await page.route("**/post/api/v1/posts/files", async (route) => {
      uploadCalled = true
      await fulfillJson(route, {
        resultCode: "201-1",
        msg: "파일이 업로드되었습니다.",
        data: {
          key: "post-files/report.pdf",
          name: "report.pdf",
          url: "https://cdn.example.test/post-files/report.pdf",
        },
      })
    })

    await page.goto("/editor/new?source=local-draft")

    const writePane = page.getByTestId("markdown-editor-write-pane")
    const textarea = writePane.locator("textarea")
    await expect(textarea).toBeVisible()
    await textarea.click()
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Home" : "Control+Home")
    await page.keyboard.press("ArrowRight")

    const fileInput = page.getByTestId("markdown-editor").locator("input[type='file']:not([accept])")
    await expect(fileInput).toHaveCount(1)
    await fileInput.setInputFiles({
      name: "report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 attachment"),
    })

    await expect.poll(() => uploadCalled, { message: "post file upload request should be sent" }).toBe(true)
    await expect(page.getByText("첨부 파일 업로드에 실패했습니다.")).toHaveCount(0)
    await expect(page.getByText("첨부 파일은 10MB 이하여야 합니다.")).toHaveCount(0)
    await expect(page.getByText(/첨부 파일 업로드 실패:/)).toHaveCount(0)

    // uploadCalled는 요청 도착 시점이라 응답 반영 전에 true가 된다. 삽입 결과는 폴링으로 기다린다.
    const fileMarkdown = "[report.pdf](https://cdn.example.test/post-files/report.pdf)"
    await expect
      .poll(() => textarea.inputValue(), { message: "uploaded file markdown should be inserted at the caret" })
      .toContain(fileMarkdown)

    const editorText = await textarea.inputValue()
    expect(editorText.indexOf(fileMarkdown)).toBeLessThan(editorText.indexOf("omega"))
    await expect(page.getByTestId("markdown-editor-preview-pane").getByRole("link", { name: "report.pdf" })).toHaveAttribute(
      "href",
      "https://cdn.example.test/post-files/report.pdf"
    )
  })

  test("oversized attachment selection shows toolbar error without calling upload", async ({ page }) => {
    await routeAuthenticatedEditor(page, "body")
    let uploadCalled = false
    await page.route("**/post/api/v1/posts/files", async (route) => {
      uploadCalled = true
      await route.fulfill({ status: 500, body: "should not upload" })
    })

    await page.goto("/editor/new?source=local-draft")

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 1)
    await page
      .getByTestId("markdown-editor")
      .locator("input[type='file']:not([accept])")
      .setInputFiles({
        name: "too-large.bin",
        mimeType: "application/octet-stream",
        buffer: oversized,
      })

    await expect(page.getByTestId("markdown-editor").getByRole("alert")).toHaveText(
      "첨부 파일은 10MB 이하여야 합니다."
    )
    expect(uploadCalled).toBe(false)
  })

  test("preview keeps raw HTML script and javascript URLs out of the rendered DOM", async ({
    page,
  }) => {
    await routeAuthenticatedEditor(
      page,
      [
        "# Security preview",
        "",
        "<script>window.__markdownPreviewScript = true</script>",
        "",
        "[bad link](javascript:alert(1))",
        "",
        "![bad image](javascript:alert(1))",
      ].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const preview = page.getByTestId("markdown-editor-preview-pane")
    await expect(preview).toBeVisible()
    await expect(preview.locator("script")).toHaveCount(0)
    await expect(preview.locator("a[href^='javascript:']")).toHaveCount(0)
    await expect(preview.locator("img[src^='javascript:']")).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __markdownPreviewScript?: boolean }).__markdownPreviewScript)))
      .toBe(false)
  })

  test("code block language labels keep common fenced language aliases out of TXT fallback", async ({
    page,
  }) => {
    const languageCases = [
      ["java", "public Token login(User user) {\n  return new Token(access, refresh);\n}", "Java"],
      ["js", "const value = 1", "JavaScript"],
      ["javascript", "const value = 1", "JavaScript"],
      ["ts", "const value: string = 'ok'", "TypeScript"],
      ["typescript", "const value: string = 'ok'", "TypeScript"],
      ["tsx", "export const View = () => <div />", "TSX"],
      ["jsx", "export const View = () => <div />", "JSX"],
      ["kotlin", "fun login(): Token = token", "Kotlin"],
      ["kt", "val token = Token()", "Kotlin"],
      ["python", "def login():\n    return token", "Python"],
      ["py", "def login():\n    return token", "Python"],
      ["bash", "echo hello", "Bash"],
      ["sh", "echo hello", "Shell"],
      ["shell", "echo hello", "Shell"],
      ["sql", "SELECT * FROM users", "SQL"],
      ["yaml", "name: aquila", "YAML"],
      ["yml", "name: aquila", "YAML"],
      ["json", "{\"ok\": true}", "JSON"],
      ["html", "<main>hello</main>", "HTML"],
      ["xml", "<root>hello</root>", "XML"],
      ["css", ".login { color: red; }", "CSS"],
      ["scss", "$color: red;\n.login { color: $color; }", "SCSS"],
      ["markdown", "# Heading", "Markdown"],
      ["md", "# Heading", "Markdown"],
      ["go", "func main() {}", "Go"],
      ["rust", "fn main() {}", "Rust"],
      ["rs", "fn main() {}", "Rust"],
    ] as const

    await routeAuthenticatedEditor(
      page,
      languageCases
        .map(([language, source]) => ["```" + language, source, "```"].join("\n"))
        .join("\n\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const codeTitles = page
      .getByTestId("markdown-editor-preview-pane")
      .locator(".aq-code-title")
    await expect(codeTitles).toHaveText(languageCases.map(([, , label]) => label))
    expect(await codeTitles.allTextContents()).not.toContain("TXT")
  })

  test("code block title metadata renders in the V4 header next to copy", async ({ page }) => {
    await routeAuthenticatedEditor(
      page,
      ["```kotlin title=\"UserService.kt\"", "fun login(): Token = token", "```"].join("\n")
    )

    await page.goto("/editor/new?source=local-draft")

    const preview = page.getByTestId("markdown-editor-preview-pane")
    const codeBlock = preview.locator(".aq-code-block").first()
    await expect(codeBlock.locator(".aq-code-title")).toHaveText("UserService.kt")
    await expect(codeBlock.locator(".aq-code-copy")).toHaveText("COPY")
  })

  test("canonical summary preview applies the platform result and preserves a manual edit when the next preview fails", async ({
    page,
  }) => {
    const { title, content, expected } = leadingBlockSummaryFixture
    let previewRequestCount = 0

    await routeAuthenticatedEditor(page, content, title)
    await page.route("**/post/api/v1/adm/posts/preview-summary", async (route) => {
      previewRequestCount += 1
      expect(route.request().postDataJSON()).toEqual({ title, content })

      if (previewRequestCount === 1) {
        await fulfillJson(route, { summary: expected.summary, source: expected.source })
        return
      }

      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({}) })
    })

    await page.goto("/editor/new?source=local-draft")

    const summaryInput = page.getByRole("textbox", { name: /^Summary/ })
    const previewButton = page.getByRole("button", { name: "본문 기준으로 채우기" })
    await previewButton.click()
    await expect(summaryInput).toHaveValue(expected.summary)

    const manualSummary = "사용자가 유지한 요약"
    await summaryInput.fill(manualSummary)
    await previewButton.click()

    await expect(summaryInput).toHaveValue(manualSummary)
    await expect(page.getByText("요약 미리보기를 불러오지 못했습니다.")).toBeVisible()

    await summaryInput.fill("")
    await page.getByRole("button", { name: "발행 설정" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("요약을 비워두면 본문에서 자동 생성한 요약이 카드에 반영됩니다.")).toHaveCount(0)
  })

  test("canonical summary preview does not overwrite a manual edit made while a successful request is pending", async ({
    page,
  }) => {
    const { title, content, expected } = leadingBlockSummaryFixture
    let releasePreview: (() => void) | undefined
    let signalPreviewStarted: (() => void) | undefined
    const previewStarted = new Promise<void>((resolve) => {
      signalPreviewStarted = resolve
    })

    await routeAuthenticatedEditor(page, content, title)
    await page.route("**/post/api/v1/adm/posts/preview-summary", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ title, content })
      signalPreviewStarted?.()
      await new Promise<void>((resolve) => {
        releasePreview = resolve
      })
      await fulfillJson(route, { summary: expected.summary, source: expected.source })
    })

    await page.goto("/editor/new?source=local-draft")

    const summaryInput = page.getByRole("textbox", { name: /^Summary/ })
    const previewResponse = page.waitForResponse((response) =>
      response.url().includes("/post/api/v1/adm/posts/preview-summary") && response.status() === 200
    )
    await page.getByRole("button", { name: "본문 기준으로 채우기" }).click()
    await previewStarted

    const manualSummary = "응답 중에도 유지할 수동 요약"
    await summaryInput.fill(manualSummary)
    releasePreview?.()

    await previewResponse
    await expect(page.getByText("요약이 변경되어 미리보기 결과를 반영하지 않았습니다.")).toBeVisible()
    await expect(summaryInput).toHaveValue(manualSummary)
  })

  test("loaded canonical post exits without an unsaved-changes dialog", async ({ page }) => {
    const postId = 771
    await routeAuthenticatedEditor(page)
    await routeEditorPost(page, postId, leadingBlockSummaryFixture.content)

    await page.goto(`/editor/${postId}`)
    await expect(page.locator("#post-title")).toHaveValue("Markdown 수정 테스트")

    await page.getByRole("button", { name: "← 글 관리" }).click()
    await expect(page.getByRole("dialog", { name: "저장되지 않은 변경이 있습니다" })).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/posts/)
  })

  test("whitespace-only Summary autosaves as an empty v3 draft and survives reload", async ({ page }) => {
    const title = "공백 요약 초안"
    const content = "공백 요약도 본문은 보존해야 합니다."
    const manualSummary = "공백 전 수동 요약"
    await routeAuthenticatedEditor(page, content, title, false)

    await page.goto("/editor/new?source=local-draft")
    await page.locator("#post-title").fill(title)
    await page.getByTestId("markdown-editor-write-pane").locator("textarea").fill(content)
    await page.getByLabel("Summary").fill(manualSummary)
    await expect
      .poll(() =>
        page.evaluate((storageKey) => {
          const raw = window.localStorage.getItem(storageKey)
          return raw ? JSON.parse(raw) : null
        }, localDraftStorageKey)
      )
      .toMatchObject({
        title,
        content,
        summary: manualSummary,
        summarySource: "MANUAL",
        summaryIntent: { kind: "manual", summary: manualSummary },
      })
    const initialSavedAt = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) throw new Error("saved local draft is missing")
      return (JSON.parse(raw) as { savedAt: string }).savedAt
    }, localDraftStorageKey)
    await page.getByLabel("Summary").fill("   ")
    await expect
      .poll(() =>
        page.evaluate(({ storageKey, initialSavedAt }) => {
          const raw = window.localStorage.getItem(storageKey)
          if (!raw) {
            return {
              savedAtChanged: false,
              summary: "<missing>",
              summarySource: "<missing>",
              intentKind: "<missing>",
            }
          }
          const draft = JSON.parse(raw) as {
            summary: string
            summarySource: string
            summaryIntent: { kind: string }
            savedAt: string
          }
          return {
            savedAtChanged: draft.savedAt !== initialSavedAt,
            summary: draft.summary,
            summarySource: draft.summarySource,
            intentKind: draft.summaryIntent.kind,
          }
        }, { storageKey: localDraftStorageKey, initialSavedAt })
      )
      .toEqual({ savedAtChanged: true, summary: "", summarySource: "NONE", intentKind: "auto" })

    await page.goto("/editor/new?source=local-draft")
    await expect(page.locator("#post-title")).toHaveValue(title)
    await expect(page.getByTestId("markdown-editor-write-pane").locator("textarea")).toHaveValue(content)
    await expect(page.getByLabel("Summary")).toHaveValue("")
  })

  test("actual preview renders a leading summary block only in the body", async ({ page }) => {
    const { content, expected } = leadingBlockSummaryFixture
    const previewId = "leading-summary"
    await routeAuthenticatedEditor(page)
    await page.addInitScript(
      ({ content, previewId, summary, summarySource }) => {
        window.localStorage.setItem(
          `editor.actual-preview.v1:${previewId}`,
          JSON.stringify({
            id: previewId,
            title: "LEADING_BLOCK 실제 보기",
            content,
            summary,
            summarySource,
            tags: [],
            visibility: "PUBLIC_LISTED",
            thumbnailUrl: "",
            authorName: "aquila",
            authorImageUrl: "",
            createdAt: "2026-08-24T00:00:00.000Z",
          })
        )
      },
      { content, previewId, summary: expected.summary, summarySource: expected.source }
    )

    await page.goto(`/editor/preview/${previewId}`)
    await expect(page.locator(".deck")).toHaveCount(0)
    await expect(page.locator(".aq-markdown").getByText("OIDC는 그 위에 인증 계층을 추가합니다.", { exact: false })).toHaveCount(1)
  })
})
