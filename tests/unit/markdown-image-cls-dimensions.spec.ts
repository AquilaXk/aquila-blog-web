import { expect, test } from "@playwright/test"
import {
  parseStandaloneMarkdownImageLine,
  serializeStandaloneMarkdownImageLine,
  clampImageWidthPx,
  clampImageDimensionPx,
} from "../../src/libs/markdown/renderingImageModel"

test.describe("markdown image CLS dimension model", () => {
  test("parses both width and height from markdown metadata curly braces", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![System Architecture](https://blog.aquilaxk.site/post/api/v1/images/posts/arch.png "Architecture") {width=800 height=450 align=center}'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(800)
    expect(parsed?.heightPx).toBe(450)
    expect(parsed?.align).toBe("center")
    expect(parsed?.alt).toBe("System Architecture")
  })

  test("parses dimensions from image URL query parameters when metadata is absent", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Diagram](https://blog.aquilaxk.site/post/api/v1/images/posts/diag.png?width=640&height=360)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(640)
    expect(parsed?.heightPx).toBe(360)
  })

  test("parses dimensions from image URL shorthand w and h query parameters", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Diagram](https://blog.aquilaxk.site/post/api/v1/images/posts/diag.png?w=720&h=480)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(720)
    expect(parsed?.heightPx).toBe(480)
  })

  test("serializes standalone image line preserving width and height metadata", () => {
    const serialized = serializeStandaloneMarkdownImageLine({
      alt: "System Architecture",
      src: "https://blog.aquilaxk.site/post/api/v1/images/posts/arch.png",
      title: "Architecture",
      widthPx: 800,
      heightPx: 450,
      align: "center",
    })
    expect(serialized).toBe(
      '![System Architecture](https://blog.aquilaxk.site/post/api/v1/images/posts/arch.png "Architecture") {width=800 height=450 align=center}'
    )
  })

  test("clamps image width and dimension boundaries correctly", () => {
    expect(clampImageWidthPx(50)).toBe(180)
    expect(clampImageWidthPx(1200)).toBe(960)
    expect(clampImageWidthPx(600)).toBe(600)

    expect(clampImageDimensionPx(5)).toBe(10)
    expect(clampImageDimensionPx(3000)).toBe(2400)
    expect(clampImageDimensionPx(450)).toBe(450)
  })
})
