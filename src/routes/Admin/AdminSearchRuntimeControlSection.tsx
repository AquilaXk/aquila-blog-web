import { useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "src/apis/backend/client"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY } from "src/libs/privacy/browserStorageRegistry"
import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import {
  AdminSearchRuntimeControlModel,
  type SafeSearchRuntimeControlDisplay,
  type SearchRuntimeControl,
  type SearchRuntimeControlSessionRecord,
} from "src/routes/Admin/AdminSearchRuntimeControlModel"
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

const labels: Record<
  SearchRuntimeControl,
  { heading: string; enabled: string; disabled: string }
> = {
  pipeline: {
    heading: "Search pipeline force control",
    enabled: "Force enabled",
    disabled: "Force disabled",
  },
  mirror: {
    heading: "Search mirror force disable",
    enabled: "Force mirror disabled",
    disabled: "Allow mirror",
  },
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

const receiptLabel: Record<"ACCEPTED" | "SUCCEEDED", string> = {
  ACCEPTED: "Accepted and pending",
  SUCCEEDED: "Succeeded",
}

const describeFailure = (error: unknown, classifyPostRejection = false) => {
  if (classifyPostRejection && isSemanticConflict(error))
    return {
      clearable: true,
      message:
        "This operation ID conflicts with a different command. Clear it before creating a new request.",
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
      message:
        "The request was rejected. Clear it before creating a new request.",
    }
  const requestId = error instanceof ApiError ? error.requestId : null
  return {
    clearable: false,
    message: `${toUserFacingMessage(error)}${
      requestId ? ` Request ID: ${requestId}` : ""
    }`,
  }
}

export const AdminSearchRuntimeControlSection = ({ disabled }: Props) => {
  const [forms, setForms] = useState<Record<SearchRuntimeControl, FormState>>({
    pipeline: initialForm(),
    mirror: initialForm(),
  })
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

  const consumeReceipt = (
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
      setNotice("The operation response could not be verified.")
      return false
    }
    setDisplay(AdminSearchRuntimeControlModel.toSafeDisplay(receipt))
    setNotice("")
    setClearableFailure(false)
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
      consumeReceipt(response, sessionRecord)
    } catch (error) {
      const failure = describeFailure(error)
      setClearableFailure(failure.clearable)
      setNotice(failure.message)
    } finally {
      statusInFlight.current = false
      setBusy(false)
    }
  }

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
        "The saved operation request could not be read. No request was sent."
      )
    }
  }, [])

  useEffect(() => {
    if (
      !record ||
      disabled ||
      restoredOperationId.current !== record.operationId
    )
      return
    restoredOperationId.current = null
    void checkStatus(record)
    // A reload performs one explicit current-operation read for its saved request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, record])

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
      const failure = describeFailure(error, true)
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
        "The operation request could not be retained. No request was sent."
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
      setNotice("The saved operation request could not be cleared.")
      return
    }
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
        <QuietButton
          type="button"
          disabled={disabled || busy}
          onClick={() => void checkStatus()}
        >
          Check status
        </QuietButton>
        {!clearableFailure && !display && notice ? (
          <QuietButton
            type="button"
            disabled={disabled || busy}
            onClick={() => void postRecord(record)}
          >
            Retry same request
          </QuietButton>
        ) : null}
        {display?.status === "SUCCEEDED" || clearableFailure ? (
          <QuietButton
            type="button"
            disabled={disabled || busy}
            onClick={clearForNewCommand}
          >
            New command
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
        <strong>{receiptLabel[display.status]}</strong>
        {display.resultCode ? ` · ${display.resultCode}` : null}
        {` · ${display.controlKey}: ${display.controlValue}`}
        {display.status === "SUCCEEDED"
          ? ` · version ${display.controlVersion}`
          : null}
      </InlineNotice>
    )
  }

  return (
    <DangerPanel
      as="section"
      role="region"
      aria-label="Search runtime controls"
      aria-busy={busy}
    >
      <SubSectionHeading>
        <strong>Search runtime controls</strong>
        <small>Durable operations</small>
      </SubSectionHeading>
      {busy ? (
        <InlineNotice aria-live="polite">
          {postInFlight.current ? "Submitting…" : "Checking current status…"}
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
                  {labels[control].heading} reason
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
                  Desired state
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
                I confirm this search runtime control
              </ConfirmDeleteRow>
              <ActionRow className="wide">
                <DangerButton
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submit(control)}
                >
                  Request {labels[control].heading}
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
