import type { components } from "@shared/contracts"

type SearchPipelineForceControlRequest =
  components["schemas"]["SearchPipelineForceControlRequest"]
type SearchEngineMirrorForceDisableRequest =
  components["schemas"]["SearchEngineMirrorForceDisableRequest"]
type AdminOperationReceipt = components["schemas"]["AdminOperationResBody"]

export type SearchRuntimeControl = "pipeline" | "mirror"
export type SearchRuntimeControlRequest =
  | SearchPipelineForceControlRequest
  | SearchEngineMirrorForceDisableRequest

export type SearchRuntimeControlSessionRecord = {
  control: SearchRuntimeControl
  operationId: string
  request: SearchRuntimeControlRequest
}

export type SafeSearchRuntimeControlDisplay =
  | {
      status: "ACCEPTED"
      resultCode: null
      controlKey: "PIPELINE_FORCE_CONTROL" | "MIRROR_FORCE_DISABLE"
      controlValue: "ENABLED" | "DISABLED"
      controlVersion: null
    }
  | {
      status: "SUCCEEDED"
      resultCode:
        | "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED"
        | "SEARCH_ENGINE_MIRROR_FORCE_DISABLE_UPDATED"
      controlKey: "PIPELINE_FORCE_CONTROL" | "MIRROR_FORCE_DISABLE"
      controlValue: "ENABLED" | "DISABLED"
      controlVersion: number
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

const isBoundedReason = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" &&
  value.length <= maxLength &&
  value.trim().length > 0

const controlContracts = {
  pipeline: {
    action: "SEARCH_PIPELINE_FORCE_CONTROL",
    resultCode: "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED",
    controlKey: "PIPELINE_FORCE_CONTROL",
    requestValue: "forceControl",
  },
  mirror: {
    action: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE",
    resultCode: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE_UPDATED",
    controlKey: "MIRROR_FORCE_DISABLE",
    requestValue: "forceDisabled",
  },
} as const

const isControlValue = (value: unknown): value is "ENABLED" | "DISABLED" =>
  value === "ENABLED" || value === "DISABLED"

const isPositiveControlVersion = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

const expectedControlValue = (
  control: SearchRuntimeControl,
  request: SearchRuntimeControlRequest
) => {
  const value =
    control === "pipeline"
      ? (request as SearchPipelineForceControlRequest).forceControl
      : (request as SearchEngineMirrorForceDisableRequest).forceDisabled
  if (typeof value !== "boolean") return null
  if (control === "pipeline") return value ? "ENABLED" : "DISABLED"
  return value ? "DISABLED" : "ENABLED"
}

const isReceipt = (
  control: SearchRuntimeControl,
  value: unknown
): value is AdminOperationReceipt => {
  if (!isRecord(value)) return false
  const contract = controlContracts[control]
  const status = value.status
  const resultCode = value.resultCode
  return (
    isUuid(value.operationId) &&
    value.action === contract.action &&
    (status === "ACCEPTED" || status === "SUCCEEDED") &&
    value.controlKey === contract.controlKey &&
    isControlValue(value.controlValue) &&
    (status === "ACCEPTED"
      ? resultCode == null && value.controlVersion == null
      : resultCode === contract.resultCode &&
        isPositiveControlVersion(value.controlVersion))
  )
}

export const AdminSearchRuntimeControlModel = {
  limit: {
    reasonMax: 200,
  },

  validateRequest(
    control: SearchRuntimeControl,
    request: SearchRuntimeControlRequest
  ) {
    const operationId = request.operationId
    const reason = request.reason.trim()
    const requestValue =
      control === "pipeline"
        ? (request as SearchPipelineForceControlRequest).forceControl
        : (request as SearchEngineMirrorForceDisableRequest).forceDisabled
    const value =
      control === "pipeline"
        ? { operationId, reason, forceControl: requestValue }
        : { operationId, reason, forceDisabled: requestValue }
    const valid =
      isUuid(operationId) &&
      isBoundedReason(reason, this.limit.reasonMax) &&
      typeof requestValue === "boolean"

    return valid
      ? { ok: true as const, value: value as SearchRuntimeControlRequest }
      : {
          ok: false as const,
          message: "Check the search control request fields.",
        }
  },

  createSessionRecord(
    control: SearchRuntimeControl,
    request: SearchRuntimeControlRequest
  ): SearchRuntimeControlSessionRecord {
    return { control, operationId: request.operationId as string, request }
  },

  parseSessionRecord(
    serialized: string | null
  ): SearchRuntimeControlSessionRecord | null {
    if (!serialized) return null
    try {
      const value: unknown = JSON.parse(serialized)
      if (
        !isRecord(value) ||
        (value.control !== "pipeline" && value.control !== "mirror") ||
        !isRecord(value.request)
      )
        return null
      const validation = this.validateRequest(
        value.control,
        value.request as SearchRuntimeControlRequest
      )
      return validation.ok && value.operationId === validation.value.operationId
        ? {
            control: value.control,
            operationId: validation.value.operationId as string,
            request: validation.value,
          }
        : null
    } catch {
      return null
    }
  },

  parseOperationReceipt(
    control: SearchRuntimeControl,
    envelope: unknown
  ): AdminOperationReceipt | null {
    if (!isRecord(envelope) || !isReceipt(control, envelope.data)) return null
    return envelope.data
  },

  parseAcceptedOperationReceipt(
    control: SearchRuntimeControl,
    envelope: unknown
  ): AdminOperationReceipt | null {
    const receipt = this.parseOperationReceipt(control, envelope)
    return receipt && this.classifyReceipt(receipt) === "pending"
      ? receipt
      : null
  },

  receiptMatchesRequest(
    receipt: AdminOperationReceipt,
    sessionRecord: SearchRuntimeControlSessionRecord
  ) {
    return (
      receipt.operationId === sessionRecord.operationId &&
      receipt.controlValue ===
        expectedControlValue(sessionRecord.control, sessionRecord.request)
    )
  },

  classifyReceipt(receipt: AdminOperationReceipt): "pending" | "terminal" {
    return receipt.status === "ACCEPTED" ? "pending" : "terminal"
  },

  toSafeDisplay(
    receipt: AdminOperationReceipt
  ): SafeSearchRuntimeControlDisplay {
    if (receipt.status === "ACCEPTED")
      return {
        status: "ACCEPTED",
        resultCode: null,
        controlKey: receipt.controlKey as
          | "PIPELINE_FORCE_CONTROL"
          | "MIRROR_FORCE_DISABLE",
        controlValue: receipt.controlValue as "ENABLED" | "DISABLED",
        controlVersion: null,
      }
    return {
      status: "SUCCEEDED",
      resultCode: receipt.resultCode as
        | "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED"
        | "SEARCH_ENGINE_MIRROR_FORCE_DISABLE_UPDATED",
      controlKey: receipt.controlKey as
        | "PIPELINE_FORCE_CONTROL"
        | "MIRROR_FORCE_DISABLE",
      controlValue: receipt.controlValue as "ENABLED" | "DISABLED",
      controlVersion: receipt.controlVersion as number,
    }
  },
}
