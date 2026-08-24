import { expect, test } from "@playwright/test"
import { createDocumentFootnoteModel } from "../../src/libs/markdown/renderingFootnoteModel"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"

const createModel = (source: string) =>
  createDocumentFootnoteModel({ source, segments: parseMarkdownSegments(source) })

const getTransformedMarkdown = (model: ReturnType<typeof createModel>) =>
  model.segments.flatMap((segment) => ("content" in segment ? [segment.content] : [])).join("\n")

test("creates one document-wide footnote registry across ordinary and toggle segments", () => {
  const source = [
    "[^orphan]: 참조되지 않는 정의",
    "",
    "정책은 문서 전체에서 참조한다.[^policy]",
    "",
    ":::toggle 근거",
    "[^policy]: 첫 번째 정책 근거",
    ":::",
    "",
    "[^backward]: 먼저 정의된 근거",
    "",
    "[^policy]: 중복 정의는 표시하지 않는다.",
    "",
    "뒤쪽에서도 같은 근거를 다시 참조한다.[^policy]",
    "",
    "정의보다 뒤에 오는 backward reference.[^backward]",
    "",
    "정의되지 않은 참조는 그대로 남긴다.[^missing]",
  ].join("\n")
  const model = createModel(source)
  const transformedMarkdown = getTransformedMarkdown(model)

  expect(model.footnotes.map(({ identifier, number, targetId }) => ({ identifier, number, targetId }))).toEqual([
    { identifier: "policy", number: 1, targetId: "aq-footnote-1" },
    { identifier: "backward", number: 2, targetId: "aq-footnote-2" },
  ])
  expect(model.footnotes[0]).toEqual(expect.objectContaining({
    content: "첫 번째 정책 근거",
    referenceIds: ["aq-footnote-ref-1-1", "aq-footnote-ref-1-2"],
  }))
  expect(model.footnotes[1]).toEqual(expect.objectContaining({
    content: "먼저 정의된 근거",
    referenceIds: ["aq-footnote-ref-2-1"],
  }))
  expect(transformedMarkdown).toContain(`[1](#aq-footnote-1 "${model.marker}:aq-footnote-ref-1-1")`)
  expect(transformedMarkdown).toContain(`[1](#aq-footnote-1 "${model.marker}:aq-footnote-ref-1-2")`)
  expect(transformedMarkdown).not.toContain("중복 정의는 표시하지 않는다")
  expect(transformedMarkdown).not.toContain("참조되지 않는 정의")
  expect(transformedMarkdown).toContain("[^missing]")
  expect(model.marker).toMatch(new RegExp(`^aq-footnote:${source.length}:`))
  expect(model.marker).not.toBe("aq-footnote-ref-1-1")
})

test("keeps a footnote reference inside a definition literal and outside the registry", () => {
  const model = createModel([
    "본문 참조입니다.[^outer]",
    "",
    "[^outer]: 내부 참조는 literal로 남는다.[^inner]",
    "",
    "[^inner]: 내부 각주 정의",
  ].join("\n"))

  expect(model.footnotes).toHaveLength(1)
  expect(model.footnotes[0]).toEqual(expect.objectContaining({
    identifier: "outer",
    content: "내부 참조는 literal로 남는다.[^inner]",
  }))
  expect(getTransformedMarkdown(model)).not.toContain("aq-footnote-ref-2-1")
})

test("serializes multi-block definitions without converting their list into indented code", () => {
  const model = createModel([
    "본문 참조입니다.[^policy]",
    "",
    "[^policy]: 첫 문단",
    "",
    "    둘째 문단",
    "",
    "    - 목록 항목",
    "    - 다음 항목",
  ].join("\n"))

  expect(model.footnotes[0]?.content).toContain("둘째 문단")
  expect(model.footnotes[0]?.content).toMatch(/^[*-] 목록 항목/m)
  expect(model.footnotes[0]?.content).not.toMatch(/^    [*-] 목록 항목/m)
})

test("keeps a footnote-looking token inside inline math outside the registry", () => {
  const model = createModel([
    "수식 $x[^math]$ 는 원문으로 유지한다.",
    "",
    "[^math]: 수식 안에서는 참조가 아니다.",
  ].join("\n"))

  expect(model.footnotes).toEqual([])
  expect(getTransformedMarkdown(model)).toContain("$x[^math]$")
})

test("preserves an ordinary definition required by a footnote reference-style link", () => {
  const model = createModel([
    "본문 참조입니다.[^note]",
    "",
    "[^note]: [문서][guide]",
    "",
    "[guide]: /guide",
  ].join("\n"))

  expect(model.footnotes[0]?.content).toContain("[문서][guide]")
  expect(model.footnotes[0]?.content).toContain("[guide]: /guide")
})
