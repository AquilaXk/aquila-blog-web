import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

test.describe("editor slash menu and toolbar usability", () => {
  test("slash menu component exports expected items and styles", () => {
    const filePath = resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditorSlashMenu.tsx")
    const content = readFileSync(filePath, "utf8")

    expect(content).toContain("MarkdownEditorSlashMenu")
    expect(content).toContain("SlashMenuItem")
    expect(content).toContain("SLASH_COMMAND_SPECS")
    expect(content).toContain("role=\"menu\"")
    expect(content).toContain("role=\"menuitem\"")
    expect(content).toContain("인용구 (Quote)")
    expect(content).toContain("코드 블록 (Code)")
    expect(content).toContain("콜아웃 팁 (Tip)")
    expect(content).toContain("콜아웃 주의 (Warning)")
    expect(content).toContain("할 일 목록 (Todo)")
    expect(content).toContain("표 (Table)")
    expect(content).toContain("구분선 (Divider)")
    expect(content).toContain("width: 32px")
    expect(content).toContain("height: 32px")
    expect(content).toContain("font-size: 16px")
    expect(content).toContain("font-size: 14px")
    expect(content).toContain("width: 280px")
    expect(content).toContain("일치하는 명령어가 없습니다")
  })

  test("markdown editor wires slash command menu with real-time filtering and 1-click shortcuts", () => {
    const editorFilePath = resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditor.tsx")
    const editorContent = readFileSync(editorFilePath, "utf8")

    expect(editorContent).toContain("MarkdownEditorSlashMenu")
    expect(editorContent).toContain("SLASH_COMMAND_SPECS")
    expect(editorContent).toContain("slashMenuItems")
    expect(editorContent).toContain("checkSlashCommand")
    expect(editorContent).toContain("slashFrom")
    expect(editorContent).toContain("제목 1 (H1)")
    expect(editorContent).toContain("인용구")
    expect(editorContent).toContain("코드 블록")
  })

  test("dedicated editor surface supports sidebar toggles and focus mode with 36px title and aligned padding", () => {
    const surfaceFilePath = resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx")
    const surfaceContent = readFileSync(surfaceFilePath, "utf8")

    expect(surfaceContent).toContain("isOutlineOpen")
    expect(surfaceContent).toContain("isInspectorOpen")
    expect(surfaceContent).toContain("handleToggleZenMode")
    expect(surfaceContent).toContain("EditorSidebarToggleButton")
    expect(surfaceContent).toContain("집중 모드")

    const partsFilePath = resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx")
    const partsContent = readFileSync(partsFilePath, "utf8")

    expect(partsContent).toContain("font-size: 36px")
    expect(partsContent).toContain("padding: 22px 32px 17px")
    expect(partsContent).toContain("left: 32px")
    expect(partsContent).toContain("right: 32px")
  })

  test("editor body typography is upgraded to 16px sans-serif and toolbar chevron is 12px svg", () => {
    const stylesFilePath = resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditor.styles.ts")
    const stylesContent = readFileSync(stylesFilePath, "utf8")

    expect(stylesContent).toContain("var(--aq-font-sans")
    expect(stylesContent).toContain("font-size: 16px")
    expect(stylesContent).toContain("line-height: 1.75")
    expect(stylesContent).toContain(".cm-live-fenced-code")
    expect(stylesContent).toContain("width: 12px")
    expect(stylesContent).toContain("height: 12px")
    expect(stylesContent).toContain(".cm-placeholder")
  })

  test("live surface has comfortable scroll-past-end clearance and empty line placeholder", () => {
    const liveSurfacePath = resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditorLiveSurface.tsx")
    const liveSurfaceContent = readFileSync(liveSurfacePath, "utf8")

    expect(liveSurfaceContent).toContain("40px")

    const stylesFilePath = resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditor.styles.ts")
    const stylesContent = readFileSync(stylesFilePath, "utf8")
    expect(stylesContent).toContain("$isEmpty")
    expect(stylesContent).toContain("글 내용을 입력하거나 '/'를 눌러 서식을 빠르게 추가하세요...")
  })
})
