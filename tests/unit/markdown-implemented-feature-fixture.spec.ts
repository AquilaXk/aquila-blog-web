import { expect, test } from "@playwright/test"
import { markdownImplementedFeatureFixture } from "../fixtures/markdownImplementedFeatureFixture"
import { resolveMarkdownRenderModel } from "../../src/libs/markdown/rendering"

test("projects the implemented markdown feature fixture into its semantic render contract", () => {
  const model = resolveMarkdownRenderModel({ content: markdownImplementedFeatureFixture.body })
  const callout = model.segments.find((segment) => segment.type === "callout")
  const toggle = model.segments.find((segment) => segment.type === "toggle")
  const image = model.segments.find((segment) => segment.type === "image")
  const projection = {
    segmentTypes: model.segments.map((segment) => segment.type),
    callout: callout && {
      kind: callout.kind,
      title: callout.title,
      content: callout.content,
    },
    tableCount: model.tableLayouts.length,
    toggle: toggle && {
      title: toggle.title,
      hasRenderedFootnoteReference: /\[\d+\]\(#[^)]+\)/.test(toggle.content),
    },
    footnotes: model.footnotes.map(({ identifier, number, content, referenceIds }) => ({
      identifier,
      number,
      content,
      referenceCount: referenceIds.length,
    })),
    image: image && {
      alt: image.alt,
      src: image.src,
      title: image.title,
    },
  }

  expect(markdownImplementedFeatureFixture.schemaVersion).toBe(1)
  expect(markdownImplementedFeatureFixture.id).toBe("markdown-implemented-feature-v1")
  expect(model.normalizedContent).toBe(markdownImplementedFeatureFixture.body)
  expect(projection).toEqual(markdownImplementedFeatureFixture.expected)
})
