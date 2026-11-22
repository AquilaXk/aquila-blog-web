// 참조 구현: felixmosh/bull-board (MIT) — 검색 런타임 파이프라인·미러 제어 및 자동 폴링 상태 표시
import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "src/apis/backend/client"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { useLanguage } from "src/libs/language"
import { ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY } from "src/libs/privacy/browserStorageRegistry"
import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import {
  AdminSearchRuntimeControlModel,
  getSearchRuntimeControlLabels,
  getSearchRuntimeReceiptLabel,
  type SafeSearchRuntimeControlDisplay,
  type SearchRuntimeControl,
  type SearchRuntimeControlSessionRecord,
} from "src/routes/Admin/AdminSearchRuntimeControlModel"
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
  TextArea,
} from "src/routes/Admin/AdminToolsWorkspace.styles"

type Props = {
  disabled: boolean
}

type FormState = {
  reason: string
  target: boolean
  confirmed: boolean
}

const endpoints: Record<SearchRuntimeControl, string> = {
  pipeline: "/system/api/v1/adm/search/pipeline/force-control",
  mirror: "/system/api/v1/adm/search-engine/mirror/force-disable",
}

const initialForm = (): FormState => ({
  reason: "",
  target: true,
  confirmed: false,
})

const getRestoredTarget = (
  record: SearchRuntimeControlSessionRecord
): boolean | null => {
  if ("forceControl" in record.request) {
    return typeof record.request.forceControl === "boolean"
      ? record.request.forceControl
      : null
  }
  if ("forceDisabled" in record.request) {
    return typeof record.request.forceDisabled === "boolean"
      ? record.request.forceDisabled
      : null
  }
  return null
}

const isSemanticConflict = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 409 &&
  error.resultCode === "409-40"

const describeFailure = (error: unknown, classifyPostRejection = false, isEn = false) => {
  if (classifyPostRejection && isSemanticConflict(error))
    return {
      clearable: true,
      message: isEn
        ? "This operation ID conflicts with a different command. Clear it before creating a new request."
        : "기존 작업 ID가 다른 명령과 충돌합니다. 초기화한 뒤 새 요청을 보내세요.",
    }
  if (
    classifyPostRejection &&
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 425, 429].includes(error.status)
  )
    return {
      clearable: true,
      message: isEn
        ? "The request was rejected. Clear it before creating a new request."
        : "요청이 거부되었습니다. 초기화한 뒤 새 요청을 보내세요.",
    }
  const requestId = error instanceof ApiError ? error.requestId : null
  return {
    clearable: false,
    message: `${toUserFacingMessage(error)}${
      requestId ? ` (${isEn ? "Request ID" : "요청 ID"}: ${requestId})` : ""
    }`,
  }
}

export const AdminSearchRuntimeControlSection = ({ disabled }: Props) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const labels = getSearchRuntimeControlLabels(isEn)
  const [forms, setForms] = useState<Record<SearchRuntimeControl, FormState>>({
    pipeline: initialForm(),
    mirror: initialForm(),
  })
  const [runtimeFlagsSummary, setRuntimeFlagsSummary] = useState<string>("")
  const [record, setRecord] =
    useState<SearchRuntimeControlSessionRecord | null>(null)
  const [display, setDisplay] =
    useState<SafeSearchRuntimeControlDisplay | null>(null)
  const [notice, setNotice] = useState("")
  const [clearableFailure, setClearableFailure] = useState(false)
  const [busy, setBusy] = useState(false)
  const activeRecordRef = useRef<SearchRuntimeControlSessionRecord | null>(null)
  const postInFlight = useRef(false)
  const statusInFlight = useRef(false)
  const restoredOperationId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void apiFetch<{
      data?: {
        pipelineForceControl?: boolean
        mirrorForceDisabled?: boolean
      }
    }>("/system/api/v1/adm/search/runtime-flags", {
      cache: "no-store",
    })
      .then((res) => {
        if (!active || !res?.data) return
        const { pipelineForceControl, mirrorForceDisabled } = res.data
        setForms((current) => ({
          pipeline: {
            ...current.pipeline,
            target:
              typeof pipelineForceControl === "boolean"
                ? pipelineForceControl
                : current.pipeline.target,
          },
          mirror: {
            ...current.mirror,
            target:
              typeof mirrorForceDisabled === "boolean"
                ? mirrorForceDisabled
                : current.mirror.target,
          },
        }))
        if (
          typeof pipelineForceControl === "boolean" ||
          typeof mirrorForceDisabled === "boolean"
        ) {
          setRuntimeFlagsSummary(
            isEn
              ? `Current flags · pipeline ${
                  pipelineForceControl === undefined
                    ? "unknown"
                    : pipelineForceControl
                      ? "forced"
                      : "auto"
                } · mirror ${
                  mirrorForceDisabled === undefined
                    ? "unknown"
                    : mirrorForceDisabled
                      ? "disabled"
                      : "active"
                }`
              : `현재 설정 · 파이프라인 ${
                  pipelineForceControl === undefined
                    ? "미확인"
                    : pipelineForceControl
                      ? "강제 제어"
                      : "자동"
                } · 미러 ${
                  mirrorForceDisabled === undefined
                    ? "미확인"
                    : mirrorForceDisabled
                      ? "비활성"
                      : "정상"
                }`
          )
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isEn])

  const consumeReceipt = useCallback(
    (
      response: unknown,
      sessionRecord: SearchRuntimeControlSessionRecord,
      acceptedOnly = false
    ) => {
      const receipt = acceptedOnly
        ? AdminSearchRuntimeControlModel.parseAcceptedOperationReceipt(
            sessionRecord.control,
            response
          )
        : AdminSearchRuntimeControlModel.parseOperationReceipt(
            sessionRecord.control,
            response
          )
      if (
        !receipt ||
        !AdminSearchRuntimeControlModel.receiptMatchesRequest(
          receipt,
          sessionRecord
        )
      ) {
        setNotice(
          isEn
            ? "The operation response could not be verified."
            : "작업 응답 서명을 검증하지 못했습니다."
        )
        return false
      }
      setDisplay(AdminSearchRuntimeControlModel.toSafeDisplay(receipt))
      setNotice("")
      setClearableFailure(false)
      return true
    },
    [isEn]
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
        consumeReceipt(response, sessionRecord)
      } catch (error) {
        const failure = describeFailure(error, false, isEn)
        setClearableFailure(failure.clearable)
        setNotice(failure.message)
      } finally {
        statusInFlight.current = false
        setBusy(false)
      }
    },
    [consumeReceipt, disabled, isEn, record]
  )

  useEffect(() => {
    try {
      const restored = AdminSearchRuntimeControlModel.parseSessionRecord(
        sessionStorage.getItem(ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY)
      )
      if (!restored) return
      restoredOperationId.current = restored.operationId
      activeRecordRef.current = restored
      const target = getRestoredTarget(restored)
      if (typeof target === "boolean")
        setForms((current) => ({
          ...current,
          [restored.control]: { ...current[restored.control], target },
        }))
      setRecord(restored)
    } catch {
      setNotice(
        isEn
          ? "The saved operation request could not be read. No request was sent."
          : "저장된 작업 요청을 읽지 못해 요청을 보내지 않았습니다."
      )
    }
  }, [isEn])

  useEffect(() => {
    if (
      !record ||
      disabled ||
      restoredOperationId.current !== record.operationId
    )
      return
    restoredOperationId.current = null
    void checkStatus(record)
  }, [checkStatus, disabled, record])

  const polling = useAdminOperationPolling({
    operationId: record?.operationId,
    isAccepted: display?.status === "ACCEPTED",
    onReceipt: (response) => {
      if (record) consumeReceipt(response, record)
    },
    onFailure: (error) => {
      const failure = describeFailure(error, false, isEn)
      setClearableFailure(failure.clearable)
      setNotice(failure.message)
    },
    enabled: !disabled,
  })

  const postRecord = async (
    sessionRecord: SearchRuntimeControlSessionRecord
  ) => {
    if (disabled || postInFlight.current) return
    postInFlight.current = true
    setBusy(true)
    try {
      const response = await apiFetch(endpoints[sessionRecord.control], {
        method: "POST",
        body: JSON.stringify(sessionRecord.request),
      })
      consumeReceipt(response, sessionRecord, true)
    } catch (error) {
      const failure = describeFailure(error, true, isEn)
      setClearableFailure(failure.clearable)
      setNotice(failure.message)
    } finally {
      postInFlight.current = false
      setBusy(false)
    }
  }

  const submit = async (control: SearchRuntimeControl) => {
    if (disabled || busy || activeRecordRef.current) return
    const form = forms[control]
    if (!form.confirmed) return
    const request =
      control === "pipeline"
        ? {
            operationId: createSecureRandomUuid(),
            reason: form.reason,
            forceControl: form.target,
          }
        : {
            operationId: createSecureRandomUuid(),
            reason: form.reason,
            forceDisabled: form.target,
          }
    const validation = AdminSearchRuntimeControlModel.validateRequest(
      control,
      request
    )
    if (!validation.ok) {
      setNotice(validation.message)
      return
    }
    const nextRecord = AdminSearchRuntimeControlModel.createSessionRecord(
      control,
      validation.value
    )
    try {
      sessionStorage.setItem(
        ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY,
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
    setDisplay(null)
    setNotice("")
    setClearableFailure(false)
    await postRecord(nextRecord)
  }

  const clearForNewCommand = () => {
    if (busy) return
    try {
      sessionStorage.removeItem(ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY)
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
    setClearableFailure(false)
    setForms((current) => ({
      pipeline: { ...current.pipeline, confirmed: false },
      mirror: { ...current.mirror, confirmed: false },
    }))
  }

  const renderActiveActions = (isActive: boolean) => {
    if (!isActive || !record) return null
    return (
      <>
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
        {!clearableFailure && !display && notice ? (
          <QuietButton
            type="button"
            disabled={disabled || busy}
            onClick={() => void postRecord(record)}
          >
            {isEn ? "Retry same request" : "동일 요청 재시도"}
          </QuietButton>
        ) : null}
        {display?.status === "SUCCEEDED" || clearableFailure ? (
          <QuietButton
            type="button"
            disabled={disabled || busy}
            onClick={clearForNewCommand}
          >
            {isEn ? "New command" : "새 명령 작성"}
          </QuietButton>
        ) : null}
      </>
    )
  }

  const renderReceipt = (isActive: boolean) => {
    if (!isActive || !display) return null
    return (
      <InlineNotice
        data-tone={display.status === "SUCCEEDED" ? "success" : "warning"}
        aria-live="polite"
      >
        <strong>{getSearchRuntimeReceiptLabel(display.status, isEn)}</strong>
        {display.resultCode ? ` · ${display.resultCode}` : null}
        {` · ${display.controlKey}: ${display.controlValue}`}
        {display.status === "SUCCEEDED"
          ? ` · ${isEn ? "version" : "버전"} ${display.controlVersion}`
          : null}
      </InlineNotice>
    )
  }

  return (
    <DangerPanel
      as="section"
      role="region"
      aria-label={isEn ? "Search runtime controls" : "검색 런타임 제어"}
      aria-busy={busy}
    >
      <SubSectionHeading>
        <strong>{isEn ? "Search runtime controls" : "검색 런타임 제어"}</strong>
        <small>
          {runtimeFlagsSummary ||
            (isEn
              ? "Durable operations · search index pipeline and mirror force control"
              : "검색 색인 파이프라인 및 미러링 강제 제어")}
        </small>
      </SubSectionHeading>
      {busy ? (
        <InlineNotice aria-live="polite">
          {postInFlight.current
            ? isEn
              ? "Submitting…"
              : "요청 전송 중…"
            : isEn
              ? "Checking current status…"
              : "현재 상태 확인 중…"}
        </InlineNotice>
      ) : null}
      {(["pipeline", "mirror"] as const).map((control) => {
        const form = forms[control]
        const isActive = record?.control === control
        const fieldsDisabled = disabled || busy || !!record
        const canSubmit =
          !fieldsDisabled && form.confirmed && form.reason.trim().length > 0
        return (
          <fieldset key={control} aria-busy={busy || undefined}>
            <legend>{labels[control].heading}</legend>
            <FieldGrid>
              <FieldBox className="wide">
                <FieldLabel htmlFor={`admin-search-${control}-reason`}>
                  {isEn ? `${labels[control].heading} reason` : `${labels[control].heading} 사유`}
                </FieldLabel>
                <TextArea
                  id={`admin-search-${control}-reason`}
                  value={form.reason}
                  maxLength={AdminSearchRuntimeControlModel.limit.reasonMax}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [control]: {
                        ...current[control],
                        reason: event.target.value,
                        confirmed: false,
                      },
                    }))
                  }
                />
              </FieldBox>
              <FieldBox>
                <FieldLabel htmlFor={`admin-search-${control}-target`}>
                  {isEn ? "Desired state" : "적용 상태"}
                </FieldLabel>
                <Input
                  as="select"
                  id={`admin-search-${control}-target`}
                  value={form.target ? "true" : "false"}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [control]: {
                        ...current[control],
                        target: event.target.value === "true",
                        confirmed: false,
                      },
                    }))
                  }
                >
                  <option value="true">{labels[control].enabled}</option>
                  <option value="false">{labels[control].disabled}</option>
                </Input>
              </FieldBox>
              <ConfirmDeleteRow as="label">
                <input
                  type="checkbox"
                  checked={form.confirmed}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [control]: {
                        ...current[control],
                        confirmed: event.target.checked,
                      },
                    }))
                  }
                />{" "}
                {isEn
                  ? "I confirm this search runtime control"
                  : `${labels[control].heading} 실행을 확인했습니다`}
              </ConfirmDeleteRow>
              <ActionRow className="wide">
                <DangerButton
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submit(control)}
                >
                  {isEn ? `Request ${labels[control].heading}` : `${labels[control].heading} 요청`}
                </DangerButton>
                {renderActiveActions(isActive)}
              </ActionRow>
              {renderReceipt(isActive)}
            </FieldGrid>
          </fieldset>
        )
      })}
      {notice ? (
        <InlineNotice data-tone="danger" role="alert">
          {notice}
        </InlineNotice>
      ) : null}
    </DangerPanel>
  )
}
