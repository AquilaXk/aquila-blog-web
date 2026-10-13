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
    expect(parsed?.aspectRatio).toBe("800 / 450")
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
    expect(parsed?.aspectRatio).toBe("640 / 360")
  })

  test("parses dimensions from image URL shorthand w and h query parameters", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Diagram](https://blog.aquilaxk.site/post/api/v1/images/posts/diag.png?w=720&h=480)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(720)
    expect(parsed?.heightPx).toBe(480)
    expect(parsed?.aspectRatio).toBe("720 / 480")
  })

  test("proportionally scales large landscape images (1920x1080) to max width without aspect ratio distortion", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Landscape](https://blog.aquilaxk.site/post/api/v1/images/posts/hero.png?w=1920&h=1080)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(960)
    expect(parsed?.heightPx).toBe(540)
    expect(parsed?.aspectRatio).toBe("1920 / 1080")
  })

  test("preserves intrinsic aspect ratio when custom width is specified on image with URL dimensions", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Custom](https://blog.aquilaxk.site/post/api/v1/images/posts/hero.png?w=1920&h=1080) {width=600}'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBe(600)
    expect(parsed?.heightPx).toBe(338)
    expect(parsed?.aspectRatio).toBe("1920 / 1080")
  })

  test("ignores non-numeric query parameters and falls back gracefully", () => {
    const parsed = parseStandaloneMarkdownImageLine(
      '![Diagram](https://blog.aquilaxk.site/post/api/v1/images/posts/diag.png?w=invalid&h=bad)'
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.widthPx).toBeUndefined()
    expect(parsed?.heightPx).toBeUndefined()
    expect(parsed?.aspectRatio).toBeUndefined()
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
