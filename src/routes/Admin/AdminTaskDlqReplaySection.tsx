import { useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "src/apis/backend/client"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { ADMIN_TASK_DLQ_REPLAY_SESSION_KEY } from "src/libs/privacy/browserStorageRegistry"
import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import {
  AdminTaskDlqReplayModel,
  type SafeDlqReplayDisplay,
  type TaskDlqReplaySessionRecord,
} from "src/routes/Admin/AdminTaskDlqReplayModel"
import {
  ActionRow,
  ConfirmDeleteRow,
  DangerButton,
  DangerPanel,
  FieldBox,
  FieldGrid,
  FieldLabel,
  InlineNotice,
  Input,
  QuietButton,
  SubSectionHeading,
  SubtleMetaGrid,
  SubtleMetaItem,
  TextArea,
} from "src/routes/Admin/AdminToolsWorkspace.styles"

type Props = {
  disabled: boolean
  taskTypeSuggestions: string[]
  onTerminalReceipt: () => void
}

const receiptLabel: Record<SafeDlqReplayDisplay["status"], string> = {
  ACCEPTED: "Accepted and pending",
  SUCCEEDED: "Succeeded",
  PARTIAL: "Partially completed",
  FAILED: "Failed",
}

const describeFailure = (error: unknown) => {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.resultCode === "409-40"
  ) {
    return {
      conflict: true,
      message:
        "This operation ID conflicts with a different command. Clear it before creating a new request.",
    }
  }
  const requestId = error instanceof ApiError ? error.requestId : null
  return {
    conflict: false,
    message: `${toUserFacingMessage(error)}${
      requestId ? ` Request ID: ${requestId}` : ""
    }`,
  }
}

const receiptTone = (status: SafeDlqReplayDisplay["status"]) => {
  if (status === "SUCCEEDED") return "success"
  if (status === "FAILED") return "danger"
  return "warning"
}

export const AdminTaskDlqReplaySection = ({
  disabled,
  taskTypeSuggestions,
  onTerminalReceipt,
}: Props) => {
  const [reason, setReason] = useState("")
  const [taskType, setTaskType] = useState("")
  const [limit, setLimit] = useState("")
  const [resetRetryCount, setResetRetryCount] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [record, setRecord] = useState<TaskDlqReplaySessionRecord | null>(null)
  const [display, setDisplay] = useState<SafeDlqReplayDisplay | null>(null)
  const [notice, setNotice] = useState("")
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const postInFlight = useRef(false)
  const statusInFlight = useRef(false)
  const refreshedOperationIds = useRef(new Set<string>())
  const restoredOperationId = useRef<string | null>(null)

  const consumeReceipt = (
    response: unknown,
    expectedOperationId: string,
    acceptedOnly = false
  ) => {
    const receipt = acceptedOnly
      ? AdminTaskDlqReplayModel.parseAcceptedOperationReceipt(response)
      : AdminTaskDlqReplayModel.parseOperationReceipt(response)
    if (receipt?.operationId !== expectedOperationId) {
      setNotice("The operation response could not be verified.")
      return false
    }
    const safeDisplay = AdminTaskDlqReplayModel.toSafeDisplay(receipt)
    setDisplay(safeDisplay)
    setNotice("")
    setConflict(false)
    if (
      AdminTaskDlqReplayModel.classifyReceipt(receipt) === "terminal" &&
      !refreshedOperationIds.current.has(receipt.operationId)
    ) {
      refreshedOperationIds.current.add(receipt.operationId)
      onTerminalReceipt()
    }
    return true
  }

  const checkStatus = async (sessionRecord = record) => {
    if (!sessionRecord || disabled || statusInFlight.current) return
    statusInFlight.current = true
    setBusy(true)
    try {
      const response = await apiFetch(
        `/system/api/v1/adm/operations/${sessionRecord.operationId}`,
        { cache: "no-store" }
      )
      consumeReceipt(response, sessionRecord.operationId)
    } catch (error) {
      const failure = describeFailure(error)
      setConflict(failure.conflict)
      setNotice(failure.message)
    } finally {
      statusInFlight.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    let restored: TaskDlqReplaySessionRecord | null = null
    try {
      restored = AdminTaskDlqReplayModel.parseSessionRecord(
        sessionStorage.getItem(ADMIN_TASK_DLQ_REPLAY_SESSION_KEY)
      )
    } catch {
      setNotice(
        "The saved operation request could not be read. No request was sent."
      )
    }
    if (!restored || restoredOperationId.current === restored.operationId)
      return
    restoredOperationId.current = restored.operationId
    setRecord(restored)
    void checkStatus(restored)
    // Reload restoration performs one explicit current-result read for the saved operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const postRecord = async (sessionRecord: TaskDlqReplaySessionRecord) => {
    if (disabled || postInFlight.current) return
    postInFlight.current = true
    setBusy(true)
    try {
      const response = await apiFetch(
        "/system/api/v1/adm/operations/task-dlq-replay",
        {
          method: "POST",
          body: JSON.stringify(sessionRecord.request),
        }
      )
      consumeReceipt(response, sessionRecord.operationId, true)
    } catch (error) {
      const failure = describeFailure(error)
      setConflict(failure.conflict)
      setNotice(failure.message)
    } finally {
      postInFlight.current = false
      setBusy(false)
    }
  }

  const submit = async () => {
    if (disabled || postInFlight.current || !confirmed) return
    const requestedLimit = limit.trim() ? Number(limit) : undefined
    const validation = AdminTaskDlqReplayModel.validateRequest({
      operationId: createSecureRandomUuid(),
      reason,
      taskType: taskType || null,
      limit: requestedLimit,
      resetRetryCount,
    })
    if (!validation.ok) {
      setNotice(validation.message)
      return
    }
    const nextRecord = AdminTaskDlqReplayModel.createSessionRecord(
      validation.value
    )
    try {
      sessionStorage.setItem(
        ADMIN_TASK_DLQ_REPLAY_SESSION_KEY,
        JSON.stringify(nextRecord)
      )
    } catch {
      setNotice(
        "The operation request could not be retained. No request was sent."
      )
      return
    }
    setRecord(nextRecord)
    await postRecord(nextRecord)
  }

  const clearForNewCommand = () => {
    try {
      sessionStorage.removeItem(ADMIN_TASK_DLQ_REPLAY_SESSION_KEY)
    } catch {
      setNotice("The saved operation request could not be cleared.")
      return
    }
    setRecord(null)
    setDisplay(null)
    setNotice("")
    setConflict(false)
    setConfirmed(false)
  }

  const canSubmit =
    !disabled && !busy && !record && confirmed && reason.trim().length > 0

  return (
    <DangerPanel as="section" role="region" aria-label="DLQ replay">
      <SubSectionHeading>
        <strong>DLQ replay</strong>
        <small>Durable operation</small>
      </SubSectionHeading>
      {!record ? (
        <FieldGrid>
          <FieldBox className="wide">
            <FieldLabel htmlFor="admin-task-dlq-reason">Reason</FieldLabel>
            <TextArea
              id="admin-task-dlq-reason"
              value={reason}
              maxLength={AdminTaskDlqReplayModel.limit.reasonMax}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldBox>
          <FieldBox>
            <FieldLabel htmlFor="admin-task-dlq-type">Task type</FieldLabel>
            <Input
              as="select"
              id="admin-task-dlq-type"
              value={taskType}
              onChange={(event) => setTaskType(event.target.value)}
            >
              <option value="">All current task types</option>
              {taskTypeSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion}>
                  {suggestion}
                </option>
              ))}
            </Input>
          </FieldBox>
          <FieldBox>
            <FieldLabel htmlFor="admin-task-dlq-limit">Replay limit</FieldLabel>
            <Input
              id="admin-task-dlq-limit"
              type="number"
              min={AdminTaskDlqReplayModel.limit.min}
              max={AdminTaskDlqReplayModel.limit.max}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </FieldBox>
          <ConfirmDeleteRow as="label">
            <input
              type="checkbox"
              checked={resetRetryCount}
              onChange={(event) => setResetRetryCount(event.target.checked)}
            />{" "}
            Reset retry count
          </ConfirmDeleteRow>
          <ConfirmDeleteRow as="label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            I confirm this DLQ replay
          </ConfirmDeleteRow>
          <ActionRow className="wide">
            <DangerButton
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              Request DLQ replay
            </DangerButton>
          </ActionRow>
        </FieldGrid>
      ) : (
        <>
          {display ? (
            <>
              <InlineNotice
                data-tone={receiptTone(display.status)}
                aria-live="polite"
              >
                <strong>{receiptLabel[display.status]}</strong>
                {display.resultCode ? ` · ${display.resultCode}` : null}
              </InlineNotice>
              <SubtleMetaGrid>
                <SubtleMetaItem>
                  <span>Selected</span>
                  <strong>Selected {display.selectedCount}</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>Replayed</span>
                  <strong>Replayed {display.replayedCount}</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>Quarantined</span>
                  <strong>Quarantined {display.quarantinedCount}</strong>
                </SubtleMetaItem>
              </SubtleMetaGrid>
            </>
          ) : null}
          <ActionRow>
            <QuietButton
              type="button"
              disabled={disabled || busy}
              onClick={() => void checkStatus()}
            >
              Check status
            </QuietButton>
            {conflict || (display && display.status !== "ACCEPTED") ? (
              <QuietButton
                type="button"
                disabled={disabled || busy}
                onClick={clearForNewCommand}
              >
                New command
              </QuietButton>
            ) : null}
            {!conflict && !display && notice ? (
              <QuietButton
                type="button"
                disabled={disabled || busy}
                onClick={() => void postRecord(record)}
              >
                Retry same request
              </QuietButton>
            ) : null}
          </ActionRow>
        </>
      )}
      {notice ? (
        <InlineNotice data-tone="danger" role="alert">
          {notice}
        </InlineNotice>
      ) : null}
    </DangerPanel>
  )
}
