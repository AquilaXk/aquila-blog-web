// 참조 구현: felixmosh/bull-board (MIT) — DLQ 재실행 제어, 폴링 상태 표시 및 실패 목록 오류 격리
import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "src/apis/backend/client"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { listTaskDlqItems, type TaskDlqItem } from "src/apis/backend/tasks"
import { useLanguage } from "src/libs/language"
import { ADMIN_TASK_DLQ_REPLAY_SESSION_KEY } from "src/libs/privacy/browserStorageRegistry"
import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import {
  AdminTaskDlqReplayModel,
  type SafeDlqReplayDisplay,
  type TaskDlqReplaySessionRecord,
} from "src/routes/Admin/AdminTaskDlqReplayModel"
import { AdminTaskDlqTable } from "./AdminTaskDlqTable"
import {
  formatOperationPollingStatus,
  useAdminOperationPolling,
} from "./useAdminOperationPolling"
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
  StatusBadge,
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

const getReceiptLabel = (status: SafeDlqReplayDisplay["status"], isEn: boolean): string => {
  if (isEn) {
    if (status === "ACCEPTED") return "Accepted and pending"
    if (status === "SUCCEEDED") return "Succeeded"
    if (status === "PARTIAL") return "Partially completed"
    return "Failed"
  }
  if (status === "ACCEPTED") return "요청 접수 · 처리 대기"
  if (status === "SUCCEEDED") return "재실행 완료"
  if (status === "PARTIAL") return "부분 완료"
  return "실패"
}

const describeFailure = (error: unknown, isEn: boolean) => {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.resultCode === "409-40"
  ) {
    return {
      conflict: true,
      message: isEn
        ? "This operation ID conflicts with a different command. Clear it before creating a new request."
        : "기존 작업 ID가 다른 명령과 충돌합니다. 초기화한 뒤 새 요청을 보내세요.",
    }
  }
  const requestId = error instanceof ApiError ? error.requestId : null
  return {
    conflict: false,
    message: `${toUserFacingMessage(error)}${
      requestId ? ` (${isEn ? "Request ID" : "요청 ID"}: ${requestId})` : ""
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
  const { language } = useLanguage()
  const isEn = language === "en"
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

  const [dlqTasks, setDlqTasks] = useState<TaskDlqItem[]>([])
  const [dlqTasksError, setDlqTasksError] = useState("")
  const [isTasksLoading, setIsTasksLoading] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<number>>(
    () => new Set()
  )

  const activeRecordRef = useRef<TaskDlqReplaySessionRecord | null>(null)
  const postInFlight = useRef(false)
  const statusInFlight = useRef(false)
  const refreshedOperationIds = useRef(new Set<string>())
  const restoredOperationId = useRef<string | null>(null)
  const restoredStatusRequestedOperationId = useRef<string | null>(null)

  const fetchDlqTasks = useCallback(async () => {
    setIsTasksLoading(true)
    try {
      const res = await listTaskDlqItems({
        taskType: taskType || undefined,
        limit: 50,
      })
      setDlqTasks(res || [])
      setDlqTasksError("")
    } catch (error) {
      setDlqTasks([])
      setDlqTasksError(toUserFacingMessage(error))
    } finally {
      setIsTasksLoading(false)
    }
  }, [taskType])

  useEffect(() => {
    void fetchDlqTasks()
  }, [fetchDlqTasks])

  const consumeReceipt = useCallback(
    (
      response: unknown,
      expectedOperationId: string,
      acceptedOnly = false
    ) => {
      const receipt = acceptedOnly
        ? AdminTaskDlqReplayModel.parseAcceptedOperationReceipt(response)
        : AdminTaskDlqReplayModel.parseOperationReceipt(response)
      if (receipt?.operationId !== expectedOperationId) {
        setNotice(
          isEn
            ? "The operation response could not be verified."
            : "작업 응답 서명을 검증하지 못했습니다."
        )
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
        setSelectedTaskIds(new Set())
        void fetchDlqTasks()
        onTerminalReceipt()
      }
      return true
    },
    [fetchDlqTasks, isEn, onTerminalReceipt]
  )

  const checkStatus = useCallback(
    async (sessionRecord = record) => {
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
        const failure = describeFailure(error, isEn)
        setConflict(failure.conflict)
        setNotice(failure.message)
      } finally {
        statusInFlight.current = false
        setBusy(false)
      }
    },
    [consumeReceipt, disabled, isEn, record]
  )

  useEffect(() => {
    let restored: TaskDlqReplaySessionRecord | null = null
    try {
      restored = AdminTaskDlqReplayModel.parseSessionRecord(
        sessionStorage.getItem(ADMIN_TASK_DLQ_REPLAY_SESSION_KEY)
      )
    } catch {
      setNotice(
        isEn
          ? "The saved operation request could not be read. No request was sent."
          : "저장된 작업 요청을 읽지 못해 요청을 보내지 않았습니다."
      )
    }
    if (!restored || restoredOperationId.current === restored.operationId)
      return
    restoredOperationId.current = restored.operationId
    activeRecordRef.current = restored
    setRecord(restored)
  }, [isEn])

  useEffect(() => {
    if (
      !record ||
      disabled ||
      restoredOperationId.current !== record.operationId ||
      restoredStatusRequestedOperationId.current === record.operationId
    ) {
      return
    }
    restoredStatusRequestedOperationId.current = record.operationId
    void checkStatus(record)
  }, [checkStatus, disabled, record])

  const polling = useAdminOperationPolling({
    operationId: record?.operationId,
    isAccepted: display?.status === "ACCEPTED",
    onReceipt: (response) => {
      if (record?.operationId) consumeReceipt(response, record.operationId)
    },
    onFailure: (error) => {
      const failure = describeFailure(error, isEn)
      setConflict(failure.conflict)
      setNotice(failure.message)
    },
    enabled: !disabled,
  })

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
      const failure = describeFailure(error, isEn)
      setConflict(failure.conflict)
      setNotice(failure.message)
    } finally {
      postInFlight.current = false
      setBusy(false)
    }
  }

  const submit = async (overrideTaskIds?: number[]) => {
    if (disabled || postInFlight.current || activeRecordRef.current) return
    if (!confirmed) {
      setNotice(
        isEn
          ? "Please confirm the DLQ replay checkbox before submitting."
          : "재실행 확인 체크박스를 먼저 선택해주세요."
      )
      return
    }
    const requestedLimit = limit.trim() ? Number(limit) : undefined
    const validation = AdminTaskDlqReplayModel.validateRequest({
      operationId: createSecureRandomUuid(),
      reason: reason.trim(),
      taskType: taskType || null,
      limit: requestedLimit,
      resetRetryCount,
      taskIds:
        overrideTaskIds ??
        (selectedTaskIds.size > 0 ? Array.from(selectedTaskIds) : undefined),
    })
    if (!validation.ok) {
      setNotice(validation.message)
      return
    }
    setNotice("")
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
        isEn
          ? "The operation request could not be retained. No request was sent."
          : "작업 요청을 세션에 저장하지 못해 요청을 보내지 않았습니다."
      )
      return
    }
    activeRecordRef.current = nextRecord
    setRecord(nextRecord)
    await postRecord(nextRecord)
  }

  const clearForNewCommand = () => {
    if (postInFlight.current || statusInFlight.current) return
    try {
      sessionStorage.removeItem(ADMIN_TASK_DLQ_REPLAY_SESSION_KEY)
    } catch {
      setNotice(
        isEn
          ? "The saved operation request could not be cleared."
          : "저장된 작업 요청 기록을 지우지 못했습니다."
      )
      return
    }
    polling.resetPolling()
    activeRecordRef.current = null
    setRecord(null)
    setDisplay(null)
    setNotice("")
    setConflict(false)
    setConfirmed(false)
  }

  const canSubmit =
    !disabled && !busy && !record && confirmed && reason.trim().length > 0

  return (
    <>
      <DangerPanel
        as="section"
        role="region"
        aria-label={isEn ? "DLQ replay" : "실패 작업 재실행 (DLQ)"}
      >
        <SubSectionHeading>
          <strong>{isEn ? "DLQ replay" : "실패 작업 재실행 (DLQ)"}</strong>
          <small>{isEn ? "Durable operation" : "멱등 비동기 복구 작업"}</small>
        </SubSectionHeading>
        {!record || (busy && !display && !notice) ? (
          <FieldGrid>
            <FieldBox className="wide">
              <FieldLabel htmlFor="admin-task-dlq-reason">
                {isEn ? "Reason" : "실행 사유"}
              </FieldLabel>
              <TextArea
                id="admin-task-dlq-reason"
                value={reason}
                maxLength={AdminTaskDlqReplayModel.limit.reasonMax}
                onChange={(event) => setReason(event.target.value)}
              />
            </FieldBox>
            <FieldBox>
              <FieldLabel htmlFor="admin-task-dlq-type">
                {isEn ? "Task type" : "작업 유형"}
              </FieldLabel>
              <Input
                as="select"
                id="admin-task-dlq-type"
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
              >
                <option value="">{isEn ? "All current task types" : "전체 작업 유형"}</option>
                {taskTypeSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion}>
                    {suggestion}
                  </option>
                ))}
              </Input>
            </FieldBox>
            <FieldBox>
              <FieldLabel htmlFor="admin-task-dlq-limit">
                {isEn ? "Replay limit" : "최대 재실행 건수"}
              </FieldLabel>
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
              {isEn ? "Reset retry count" : "재시도 횟수 초기화"}
            </ConfirmDeleteRow>
            <ConfirmDeleteRow as="label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{" "}
              {isEn ? "I confirm this DLQ replay" : "위 조건으로 실패 작업 재실행을 확인했습니다"}
            </ConfirmDeleteRow>
            <ActionRow className="wide">
              <DangerButton
                type="button"
                disabled={!canSubmit}
                onClick={() => void submit()}
              >
                {isEn ? "Request DLQ replay" : "DLQ 재실행 요청"}
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
                  <strong>{getReceiptLabel(display.status, isEn)}</strong>
                  {display.resultCode ? ` · ${display.resultCode}` : null}
                </InlineNotice>
                <SubtleMetaGrid>
                  <SubtleMetaItem>
                    <span>{isEn ? "Selected" : "대상 선택"}</span>
                    <strong>{isEn ? `Selected ${display.selectedCount}` : `${display.selectedCount}건 선택`}</strong>
                  </SubtleMetaItem>
                  <SubtleMetaItem>
                    <span>{isEn ? "Replayed" : "재실행됨"}</span>
                    <strong>{isEn ? `Replayed ${display.replayedCount}` : `${display.replayedCount}건 재실행`}</strong>
                  </SubtleMetaItem>
                  <SubtleMetaItem>
                    <span>{isEn ? "Quarantined" : "격리 유지"}</span>
                    <strong>{isEn ? `Quarantined ${display.quarantinedCount}` : `${display.quarantinedCount}건 격리`}</strong>
                  </SubtleMetaItem>
                </SubtleMetaGrid>
              </>
            ) : null}
            <ActionRow>
              {display?.status === "ACCEPTED" ? (
                <StatusBadge data-ui="operation-polling-badge">
                  {formatOperationPollingStatus(
                    polling.isPolling,
                    polling.pollAttempt,
                    polling.maxAttempts
                  )}
                </StatusBadge>
              ) : null}
              <QuietButton
                type="button"
                disabled={disabled || busy || polling.isPolling}
                onClick={() => void checkStatus()}
              >
                {isEn ? "Check status" : "상태 확인"}
              </QuietButton>
              {conflict || (display && display.status !== "ACCEPTED") ? (
                <QuietButton
                  type="button"
                  disabled={disabled || busy}
                  onClick={clearForNewCommand}
                >
                  {isEn ? "New command" : "새 요청 작성"}
                </QuietButton>
              ) : null}
              {!conflict && !display && notice ? (
                <QuietButton
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => void postRecord(record)}
                >
                  {isEn ? "Retry same request" : "동일 요청 재시도"}
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

      <AdminTaskDlqTable
        tasks={dlqTasks}
        errorMessage={dlqTasksError}
        isLoading={isTasksLoading}
        selectedTaskIds={selectedTaskIds}
        onSelectedTaskIdsChange={setSelectedTaskIds}
        onReplaySelected={(taskIds) => void submit(taskIds)}
        onRetryFetch={() => void fetchDlqTasks()}
        disabled={disabled || busy || Boolean(record)}
      />
    </>
  )
}
