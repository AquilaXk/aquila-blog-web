import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import type { components } from "@shared/contracts"
import { AdminSearchRuntimeControlModel } from "../../src/routes/Admin/AdminSearchRuntimeControlModel"

type SearchPipelineRequest =
  components["schemas"]["SearchPipelineForceControlRequest"]
type SearchMirrorRequest =
  components["schemas"]["SearchEngineMirrorForceDisableRequest"]

const OPERATION_ID = "8d39047c-7791-4c0f-9136-0fcdb021942d"

const pipelineRequest = (
  overrides: Partial<SearchPipelineRequest> = {}
): SearchPipelineRequest => ({
  operationId: OPERATION_ID,
  reason: "Temporarily force the search pipeline control.",
  forceControl: true,
  ...overrides,
})

const mirrorRequest = (
  overrides: Partial<SearchMirrorRequest> = {}
): SearchMirrorRequest => ({
  operationId: OPERATION_ID,
  reason: "Temporarily force the search mirror disable control.",
  forceDisabled: true,
  ...overrides,
})

test("validates exact boolean search control commands and preserves one semantic retry record", () => {
  const openApi = JSON.parse(
    readFileSync("contracts/platform/openapi.json", "utf8")
  )
  const pipelineSchema =
    openApi.components.schemas.SearchPipelineForceControlRequest
  const mirrorSchema =
    openApi.components.schemas.SearchEngineMirrorForceDisableRequest
  const pipeline = AdminSearchRuntimeControlModel.validateRequest(
    "pipeline",
    pipelineRequest()
  )
  const mirror = AdminSearchRuntimeControlModel.validateRequest(
    "mirror",
    mirrorRequest()
  )

  expect(AdminSearchRuntimeControlModel.limit.reasonMax).toBe(
    pipelineSchema.properties.reason.maxLength
  )
  expect(mirrorSchema.properties.reason.maxLength).toBe(
    AdminSearchRuntimeControlModel.limit.reasonMax
  )
  expect(pipeline).toEqual({ ok: true, value: pipelineRequest() })
  expect(mirror).toEqual({ ok: true, value: mirrorRequest() })
  expect(
    AdminSearchRuntimeControlModel.validateRequest(
      "pipeline",
      pipelineRequest({ operationId: null })
    ).ok
  ).toBe(false)
  expect(
    AdminSearchRuntimeControlModel.validateRequest(
      "pipeline",
      pipelineRequest({
        reason: "a".repeat(pipelineSchema.properties.reason.maxLength + 1),
      })
    ).ok
  ).toBe(false)
  expect(
    AdminSearchRuntimeControlModel.validateRequest(
      "mirror",
      mirrorRequest({ forceDisabled: undefined })
    ).ok
  ).toBe(false)

  const record = AdminSearchRuntimeControlModel.createSessionRecord(
    "pipeline",
    pipelineRequest()
  )
  expect(
    AdminSearchRuntimeControlModel.parseSessionRecord(JSON.stringify(record))
  ).toEqual(record)
  expect(record.operationId).toBe(OPERATION_ID)
  expect(
    AdminSearchRuntimeControlModel.parseSessionRecord("not-json")
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseSessionRecord(
      JSON.stringify({ ...record, request: { ...record.request, reason: "" } })
    )
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseSessionRecord(
      JSON.stringify({
        ...record,
        operationId: "2d39047c-7791-4c0f-9136-0fcdb021942d",
      })
    )
  ).toBeNull()
})

test("accepts only correctly paired receipts and keeps ACCEPTED nonterminal", () => {
  const accepted = {
    operationId: OPERATION_ID,
    action: "SEARCH_PIPELINE_FORCE_CONTROL",
    status: "ACCEPTED",
    controlKey: "PIPELINE_FORCE_CONTROL",
    controlValue: "ENABLED",
  }
  const succeeded = {
    ...accepted,
    status: "SUCCEEDED",
    resultCode: "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED",
    controlVersion: 3,
  }

  expect(
    AdminSearchRuntimeControlModel.parseAcceptedOperationReceipt("pipeline", {
      data: accepted,
    })
  ).toEqual(accepted)
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: succeeded,
    })
  ).toEqual(succeeded)
  expect(AdminSearchRuntimeControlModel.classifyReceipt(accepted)).toBe(
    "pending"
  )
  expect(AdminSearchRuntimeControlModel.toSafeDisplay(accepted)).toEqual({
    status: "ACCEPTED",
    resultCode: null,
    controlKey: "PIPELINE_FORCE_CONTROL",
    controlValue: "ENABLED",
    controlVersion: null,
  })
  expect(AdminSearchRuntimeControlModel.classifyReceipt(succeeded)).toBe(
    "terminal"
  )
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...succeeded, action: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE" },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...succeeded, controlValue: "UNSET" },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: {
        ...succeeded,
        resultCode: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE_UPDATED",
      },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...accepted, controlVersion: 1 },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...succeeded, controlVersion: 0 },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...succeeded, status: "PARTIAL" },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.parseOperationReceipt("pipeline", {
      data: { ...succeeded, status: "FAILED" },
    })
  ).toBeNull()
  expect(
    AdminSearchRuntimeControlModel.receiptMatchesRequest(succeeded, {
      control: "pipeline",
      operationId: OPERATION_ID,
      request: pipelineRequest(),
    })
  ).toBe(true)
  expect(
    AdminSearchRuntimeControlModel.receiptMatchesRequest(
      { ...succeeded, controlValue: "DISABLED" },
      {
        control: "pipeline",
        operationId: OPERATION_ID,
        request: pipelineRequest(),
      }
    )
  ).toBe(false)
  expect(AdminSearchRuntimeControlModel.toSafeDisplay(succeeded)).toEqual({
    status: "SUCCEEDED",
    resultCode: "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED",
    controlKey: "PIPELINE_FORCE_CONTROL",
    controlValue: "ENABLED",
    controlVersion: 3,
  })
})
