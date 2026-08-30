import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

const sourcePath = (...segments: string[]) => resolve(__dirname, "../src", ...segments)

test.describe("editor authoring structure", () => {
  test("keeps removed block-editor routes and implementation out of the frontend tree", () => {
    const forbiddenPaths = [
      sourcePath("components", "editor"),
      sourcePath("pages", "_qa", "block-editor-slash.tsx"),
      sourcePath("routes", "Admin", "QaEditorHarness.tsx"),
    ]

    expect(forbiddenPaths.filter((path) => existsSync(path))).toEqual([])
  })

  test("keeps one writer host contract without preview-only props or mode owners", () => {
    const writerHostSource = readFileSync(sourcePath("routes/Admin/WriterEditorHost.tsx"), "utf8")
    const markdownEditorSource = readFileSync(
      sourcePath("components/markdown-editor/MarkdownEditor.tsx"),
      "utf8"
    )

    expect(writerHostSource).toContain("MarkdownEditor")
    expect(writerHostSource).not.toContain("previewTitle")
    expect(writerHostSource).not.toContain("previewSummary")
    expect(markdownEditorSource).toContain("MarkdownEditorLiveSurface")
    expect(markdownEditorSource).not.toContain("MarkdownRenderer")
    expect(markdownEditorSource).not.toContain("markdown-editor-preview-pane")
  })

  test("keeps removed block-editor affordances out of the dedicated writer surface", () => {
    const dedicatedSurfaceSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioDedicatedEditorSurface.tsx"),
      "utf8"
    )
    const controllerSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioWorkspaceControllerRootView.tsx"),
      "utf8"
    )

    expect(dedicatedSurfaceSource).not.toContain("block-drag-handle")
    expect(dedicatedSurfaceSource).not.toContain("keyboard-block-selection-overlay")
    expect(controllerSource).not.toContain("BLOCK_EDITOR_V2_MERMAID_ENABLED")
    expect(controllerSource).not.toContain("handleBlockEditorChange")
  })

  test("keeps publish modal shell styles in their existing owner", () => {
    const publishModalSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModal.tsx"),
      "utf8"
    )
    const publishModalStylesSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModalStyles.tsx"),
      "utf8"
    )
    const shellStylesSource = readFileSync(
      sourcePath("routes/Admin/EditorStudioPublishModalShellStyles.tsx"),
      "utf8"
    )

    expect(publishModalSource).toContain('from "./EditorStudioPublishModalStyles"')
    expect(publishModalStylesSource).toContain('from "./EditorStudioPublishModalShellStyles"')
    expect(shellStylesSource).toContain("export const PublishModalBackdrop")
    expect(shellStylesSource).toContain("export const PublishDialog")
    expect(shellStylesSource).toContain("export const PublishModalFooter")
  })
})
