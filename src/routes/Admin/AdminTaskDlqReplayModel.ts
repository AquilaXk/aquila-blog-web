import type { components } from "@shared/contracts"

type TaskDlqReplayRequest =
  components["schemas"]["TaskDlqReplayOperationRequest"]
type AdminOperationReceipt = components["schemas"]["AdminOperationResBody"]

export type TaskDlqReplaySessionRecord = {
  operationId: string
  request: TaskDlqReplayRequest
}

export type SafeDlqReplayDisplay = Pick<
  Required<AdminOperationReceipt>,
  | "status"
  | "resultCode"
  | "selectedCount"
  | "replayedCount"
  | "quarantinedCount"
>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isBoundedText = (
  value: unknown,
  maxLength: number,
  allowEmpty = false
): value is string =>
  typeof value === "string" &&
  value.length <= maxLength &&
  (allowEmpty || value.trim().length > 0)

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

const isFiniteCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

const receiptStatuses = new Set(["ACCEPTED", "SUCCEEDED", "PARTIAL", "FAILED"])
const resultCodes = new Set([
  "NO_MATCHING_TASKS",
  "ALL_TASKS_QUARANTINED",
  "TASKS_REPLAYED",
  "TASKS_PARTIALLY_REPLAYED",
])

const hasValidStatusResult = (status: unknown, resultCode: unknown) => {
  if (status === "ACCEPTED") return resultCode == null
  if (status === "SUCCEEDED")
    return resultCode === "NO_MATCHING_TASKS" || resultCode === "TASKS_REPLAYED"
  if (status === "PARTIAL") return resultCode === "TASKS_PARTIALLY_REPLAYED"
  if (status === "FAILED") return resultCode === "ALL_TASKS_QUARANTINED"
  return false
}

const isReceipt = (value: unknown): value is AdminOperationReceipt => {
  if (!isRecord(value)) return false
  return (
    isUuid(value.operationId) &&
    value.action === "TASK_DLQ_REPLAY" &&
    typeof value.status === "string" &&
    receiptStatuses.has(value.status) &&
    hasValidStatusResult(value.status, value.resultCode) &&
    isFiniteCount(value.selectedCount) &&
    isFiniteCount(value.replayedCount) &&
    isFiniteCount(value.quarantinedCount) &&
    (value.resultCode == null ||
      (typeof value.resultCode === "string" &&
        resultCodes.has(value.resultCode)))
  )
}

export const AdminTaskDlqReplayModel = {
  limit: {
    min: 1,
    max: 200,
    reasonMax: 200,
    taskTypeMax: 120,
  },

  validateRequest(request: TaskDlqReplayRequest) {
    const normalized: TaskDlqReplayRequest = {
      operationId: request.operationId,
      reason: request.reason.trim(),
      taskType: request.taskType?.trim() || null,
      limit: request.limit,
      resetRetryCount: request.resetRetryCount,
    }
    const valid =
      isUuid(normalized.operationId) &&
      isBoundedText(normalized.reason, this.limit.reasonMax) &&
      (normalized.taskType == null ||
        isBoundedText(normalized.taskType, this.limit.taskTypeMax)) &&
      (normalized.limit == null ||
        (Number.isInteger(normalized.limit) &&
          normalized.limit >= this.limit.min &&
          normalized.limit <= this.limit.max)) &&
      (normalized.resetRetryCount == null ||
        typeof normalized.resetRetryCount === "boolean")

    return valid
      ? { ok: true as const, value: normalized }
      : { ok: false as const, message: "Check the replay request fields." }
  },

  createSessionRecord(
    request: TaskDlqReplayRequest
  ): TaskDlqReplaySessionRecord {
    return { operationId: request.operationId, request }
  },

  parseSessionRecord(
    serialized: string | null
  ): TaskDlqReplaySessionRecord | null {
    if (!serialized) return null
    try {
      const value: unknown = JSON.parse(serialized)
      if (
        !isRecord(value) ||
        typeof value.operationId !== "string" ||
        !isRecord(value.request)
      )
        return null
      const request = value.request as TaskDlqReplayRequest
      const validation = this.validateRequest(request)
      return validation.ok && value.operationId === validation.value.operationId
        ? { operationId: value.operationId, request: validation.value }
        : null
    } catch {
      return null
    }
  },

  parseOperationReceipt(envelope: unknown): AdminOperationReceipt | null {
    if (!isRecord(envelope) || !isReceipt(envelope.data)) return null
    return envelope.data
  },

  parseAcceptedOperationReceipt(
    envelope: unknown
  ): AdminOperationReceipt | null {
    const receipt = this.parseOperationReceipt(envelope)
    return receipt && this.classifyReceipt(receipt) === "pending"
      ? receipt
      : null
  },

  classifyReceipt(receipt: AdminOperationReceipt): "pending" | "terminal" {
    return receipt.status === "ACCEPTED" ? "pending" : "terminal"
  },

  toSafeDisplay(receipt: AdminOperationReceipt): SafeDlqReplayDisplay {
    return {
      status: receipt.status as SafeDlqReplayDisplay["status"],
      resultCode: receipt.resultCode as SafeDlqReplayDisplay["resultCode"],
      selectedCount: receipt.selectedCount as number,
      replayedCount: receipt.replayedCount as number,
      quarantinedCount: receipt.quarantinedCount as number,
    }
  },
}
