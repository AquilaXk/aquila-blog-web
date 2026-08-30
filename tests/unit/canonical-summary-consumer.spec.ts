import { expect, test } from "@playwright/test"
import summaryFixtures from "../../contracts/platform/summary-fixtures.json"
import { mapPostDetail, mapPostDto } from "../../src/apis/backend/posts/PostApiMappers"
import { toCompanyNewsSummary } from "../../src/routes/Company/CompanyPageModel"
import {
  resolvePersistedSummaryResult,
  toSummaryWriteFields,
  type CanonicalSummaryState,
  type SummaryIntent,
} from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"

const fixtureById = (
  id: "manual-create" | "manual-preserve-omitted" | "auto-recompute" | "leading-block" | "none-no-fallback",
) => {
  const fixture = summaryFixtures.fixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`missing imported summary fixture: ${id}`)
  return fixture
}

const expectedSummary = (fixture: ReturnType<typeof fixtureById>) => {
  if (!fixture.expected) throw new Error(`missing expected summary fixture value: ${fixture.id}`)
  const source = fixture.expected.source
  if (!["MANUAL", "LEADING_BLOCK", "EXTRACTED", "MIGRATED", "NONE"].includes(source)) {
    throw new Error(`invalid imported summary source: ${source}`)
  }
  return {
    summary: fixture.expected.summary,
    source: source as CanonicalSummaryState["summarySource"],
  }
}

const postDto = (fixture: ReturnType<typeof fixtureById>) => {
  const expected = expectedSummary(fixture)
  return ({
  id: 35,
  createdAt: "2026-08-24T00:00:00Z",
  modifiedAt: "2026-08-24T00:00:00Z",
  authorId: 1,
  authorName: "관리자",
  authorProfileImgUrl: "",
  title: fixture.title,
  summary: expected.summary,
  summarySource: expected.source,
  content: fixture.content,
  tags: [],
  category: [],
  published: true,
  listed: true,
  likesCount: 0,
  hitCount: 0,
  })
}

test("imported canonical summary와 source를 feed/detail mapper가 그대로 보존한다", async () => {
  const fixture = fixtureById("manual-create")
  const dto = postDto(fixture)
  const expected = expectedSummary(fixture)

  const feed = mapPostDto(dto)
  const detail = await mapPostDetail(dto, { allowTrustedContentHtml: false })

  expect(feed).toMatchObject({ summary: expected.summary, summarySource: expected.source })
  expect(detail).toMatchObject({ summary: expected.summary, summarySource: expected.source })
})

test("canonical summary pair가 누락되면 public mapper가 NONE 성공으로 치환하지 않는다", () => {
  const dto = postDto(fixtureById("none-no-fallback"))
  const malformed = { ...dto, summarySource: undefined }

  expect(() => mapPostDto(malformed)).toThrow("canonical post summary pair is malformed")
})

test("Company news도 canonical summary를 공백 정규화나 JS 절단 없이 보존한다", () => {
  const fixture = fixtureById("manual-create")
  const canonicalSummary = `${expectedSummary(fixture).summary}\n${"추가 문장 ".repeat(20)}`

  expect(toCompanyNewsSummary(canonicalSummary)).toBe(canonicalSummary)
})

test("imported manual intent와 unchanged intent를 write fields로 그대로 전달한다", () => {
  const manual = fixtureById("manual-create")
  const unchanged = fixtureById("manual-preserve-omitted")
  const manualSummary = manual.request.summary
  if (typeof manualSummary !== "string") throw new Error("manual fixture summary must be a string")

  const manualIntent: SummaryIntent = { kind: "manual", summary: manualSummary }
  const unchangedIntent: SummaryIntent = { kind: "unchanged" }

  expect(toSummaryWriteFields(manualIntent)).toEqual(manual.request)
  expect(toSummaryWriteFields(unchangedIntent)).toEqual(unchanged.request)
})

test("imported AUTO intent는 입력 지우기에도 같은 canonical recompute request를 사용한다", () => {
  const automatic = fixtureById("auto-recompute")
  const automaticIntent: SummaryIntent = { kind: "auto" }

  expect(toSummaryWriteFields(automaticIntent)).toEqual(automatic.request)
})

test("persisted canonical summary response는 unchanged intent로 전이하고 malformed value를 거부한다", () => {
  const fixture = fixtureById("manual-create")
  const expected = expectedSummary(fixture)
  const currentState: CanonicalSummaryState = {
    summary: expected.summary,
    summarySource: expected.source,
    intent: { kind: "manual", summary: expected.summary },
  }

  expect(
    resolvePersistedSummaryResult(currentState, {
      summary: expected.summary,
      source: expected.source,
    }),
  ).toEqual({
    ok: true,
    state: { ...currentState, intent: { kind: "unchanged" } },
  })
  expect(resolvePersistedSummaryResult(currentState, { summary: null, source: null })).toEqual({
    ok: false,
    state: currentState,
  })
  expect(resolvePersistedSummaryResult(currentState, { summary: "", source: "MANUAL" })).toEqual({
    ok: false,
    state: currentState,
  })
})
