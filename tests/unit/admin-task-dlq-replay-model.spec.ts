import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import type { components } from "@shared/contracts"
import { AdminTaskDlqReplayModel } from "../../src/routes/Admin/AdminTaskDlqReplayModel"

type TaskDlqReplayRequest =
  components["schemas"]["TaskDlqReplayOperationRequest"]

const OPERATION_ID = "8d39047c-7791-4c0f-9136-0fcdb021942d"

const createRequest = (
  overrides: Partial<TaskDlqReplayRequest> = {}
): TaskDlqReplayRequest => ({
  operationId: OPERATION_ID,
  reason: "Recover a bounded dead-letter queue batch.",
  taskType: "MAIL_SIGNUP",
  limit: 25,
  resetRetryCount: false,
  ...overrides,
})

const acceptedReceipt = {
  operationId: OPERATION_ID,
  action: "TASK_DLQ_REPLAY",
  status: "ACCEPTED",
  selectedCount: 0,
  replayedCount: 0,
  quarantinedCount: 0,
}

const terminalReceipt = {
  ...acceptedReceipt,
  status: "PARTIAL",
  resultCode: "TASKS_PARTIALLY_REPLAYED",
  selectedCount: 5,
  replayedCount: 3,
  quarantinedCount: 2,
  actorId: 91,
  sessionRowId: 72,
  target: "task-id-raw-canary",
  reason: "reason-raw-canary",
}

test("validates the OpenAPI-bounded replay request without accepting client actor or session fields", () => {
  const openApi = JSON.parse(
    readFileSync("contracts/platform/openapi.json", "utf8")
  )
  const schema = openApi.components.schemas.TaskDlqReplayOperationRequest
  expect(AdminTaskDlqReplayModel.limit).toMatchObject({
    min: schema.properties.limit.minimum,
    max: schema.properties.limit.maximum,
    reasonMax: schema.properties.reason.maxLength,
    taskTypeMax: schema.properties.taskType.maxLength,
  })
  expect(
    AdminTaskDlqReplayModel.validateRequest(createRequest({ limit: 1 }))
  ).toEqual({ ok: true, value: createRequest({ limit: 1 }) })
  expect(
    AdminTaskDlqReplayModel.validateRequest(
      createRequest({ limit: 200, taskType: null })
    )
  ).toEqual({
    ok: true,
    value: createRequest({ limit: 200, taskType: null }),
  })
  expect(
    AdminTaskDlqReplayModel.validateRequest(createRequest({ reason: "   " })).ok
  ).toBe(false)
  expect(
    AdminTaskDlqReplayModel.validateRequest(
      createRequest({ reason: "a".repeat(201) })
    ).ok
  ).toBe(false)
  expect(
    AdminTaskDlqReplayModel.validateRequest(createRequest({ limit: 0 })).ok
  ).toBe(false)
  expect(
    AdminTaskDlqReplayModel.validateRequest(createRequest({ limit: 201 })).ok
  ).toBe(false)
})

test("restores only the exact persisted operation request and preserves its secure UUID", () => {
  const request = createRequest({ limit: 200, resetRetryCount: true })
  const record = AdminTaskDlqReplayModel.createSessionRecord(request)
  const restored = AdminTaskDlqReplayModel.parseSessionRecord(
    JSON.stringify(record)
  )

  expect(restored).toEqual(record)
  expect(restored?.request).toEqual(request)
  expect(restored?.operationId).toBe(OPERATION_ID)
  expect(AdminTaskDlqReplayModel.parseSessionRecord("not-json")).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseSessionRecord(
      JSON.stringify({ operationId: OPERATION_ID })
    )
  ).toBeNull()
})

test("fails closed for malformed, missing, and unknown operation responses", () => {
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({ data: acceptedReceipt })
  ).toEqual(acceptedReceipt)
  expect(
    AdminTaskDlqReplayModel.parseAcceptedOperationReceipt({
      data: acceptedReceipt,
    })
  ).toEqual(acceptedReceipt)
  expect(
    AdminTaskDlqReplayModel.parseAcceptedOperationReceipt({
      data: terminalReceipt,
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...acceptedReceipt, status: "UNKNOWN" },
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...acceptedReceipt, selectedCount: "0" },
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...acceptedReceipt, operationId: undefined },
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...acceptedReceipt, action: undefined },
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...terminalReceipt, resultCode: null },
    })
  ).toBeNull()
  expect(
    AdminTaskDlqReplayModel.parseOperationReceipt({
      data: { ...terminalReceipt, status: "FAILED" },
    })
  ).toBeNull()
})

test("keeps acceptance pending and makes only server terminal receipts terminal", () => {
  expect(AdminTaskDlqReplayModel.classifyReceipt(acceptedReceipt)).toBe(
    "pending"
  )
  expect(
    AdminTaskDlqReplayModel.classifyReceipt({
      ...terminalReceipt,
      status: "SUCCEEDED",
    })
  ).toBe("terminal")
  expect(AdminTaskDlqReplayModel.classifyReceipt(terminalReceipt)).toBe(
    "terminal"
  )
  expect(
    AdminTaskDlqReplayModel.classifyReceipt({
      ...terminalReceipt,
      status: "FAILED",
    })
  ).toBe("terminal")
})

test("builds a display-only receipt from the explicit aggregate whitelist", () => {
  expect(AdminTaskDlqReplayModel.toSafeDisplay(terminalReceipt)).toEqual({
    status: "PARTIAL",
    resultCode: "TASKS_PARTIALLY_REPLAYED",
    selectedCount: 5,
    replayedCount: 3,
    quarantinedCount: 2,
  })
})
