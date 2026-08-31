import styled from "@emotion/styled"
import type { components } from "@shared/contracts"
import type { GetServerSideProps, NextPage } from "next"
import { useRouter } from "next/router"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { apiFetch } from "src/apis/backend/client"
import { toAuthErrorMessage } from "src/apis/backend/errorMessages"
import type { AuthMember } from "src/hooks/useAuthSession"
import { normalizeAdminNextPath } from "src/libs/router"
import { fetchServerAdminSession } from "src/libs/server/authSession"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import { isValidAuthEmail, normalizeAuthEmail } from "src/libs/validation/auth"

type AdminLoginPageProps = {
  nextPath: string
}

const ADMIN_SAVED_EMAIL_STORAGE_KEY = "auth.admin.savedEmail.v1"

type AdminEmailCodeRequest = components["schemas"]["AdminEmailCodeRequest"]
type AdminEmailCodeVerifyRequest =
  components["schemas"]["AdminEmailCodeVerifyRequest"]
type AdminEmailChallengeResponse =
  components["schemas"]["RsDataAdminEmailCodeRequestResBody"]

type LoginStep = "request" | "verify"
type LoginPhase = "idle" | "requesting" | "verifying" | "navigating"

const formatRemainingTime = (seconds: number | null) => {
  if (seconds === null) return "--:--"
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`
}

export const getServerSideProps: GetServerSideProps<AdminLoginPageProps> =
  withSsrMetrics<AdminLoginPageProps>("auth", async ({ req, query }) => {
    const member = await fetchServerAdminSession(req)
    if (member === undefined) {
      throw new Error("Unable to verify the administrator session.")
    }

    if (member?.isAdmin) {
      return {
        redirect: {
          destination: normalizeAdminNextPath(query.next, "/admin"),
          permanent: false,
        },
      }
    }

    return {
      props: {
        nextPath: normalizeAdminNextPath(query.next, "/admin"),
      },
    }
  })

const AdminLoginPage: NextPage<AdminLoginPageProps> = ({ nextPath }) => {
  const router = useRouter()
  const destination = useMemo(
    () => normalizeAdminNextPath(router.query.next, nextPath),
    [nextPath, router.query.next]
  )
  const [email, setEmail] = useState("")
  const [saveEmail, setSaveEmail] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [step, setStep] = useState<LoginStep>("request")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<LoginPhase>("idle")
  const [hydrated, setHydrated] = useState(false)
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number | null>(
    null
  )
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem(
        ADMIN_SAVED_EMAIL_STORAGE_KEY
      )
      if (savedEmail) {
        setEmail(normalizeAuthEmail(savedEmail))
        setSaveEmail(true)
      }
    } catch {
      // Browser storage is optional for login preferences.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (challengeExpiresAt === null) return

    const updateRemainingSeconds = () => {
      const nextRemainingSeconds = Math.max(
        0,
        Math.ceil((challengeExpiresAt - Date.now()) / 1_000)
      )
      setRemainingSeconds(nextRemainingSeconds)
      if (nextRemainingSeconds === 0) window.clearInterval(intervalId)
    }
    const intervalId = window.setInterval(updateRemainingSeconds, 1_000)
    return () => window.clearInterval(intervalId)
  }, [challengeExpiresAt])

  const updateSavedEmail = (value: string, shouldSave: boolean) => {
    try {
      const normalizedEmail = normalizeAuthEmail(value)
      if (shouldSave && normalizedEmail && isValidAuthEmail(normalizedEmail)) {
        window.localStorage.setItem(
          ADMIN_SAVED_EMAIL_STORAGE_KEY,
          normalizedEmail
        )
        return
      }
      window.localStorage.removeItem(ADMIN_SAVED_EMAIL_STORAGE_KEY)
    } catch {
      // Browser storage is optional for login preferences.
    }
  }

  const resetChallenge = () => {
    setPhase("idle")
    setStep("request")
    setChallengeId("")
    setCode("")
    setChallengeExpiresAt(null)
    setRemainingSeconds(null)
    setStatusMessage("")
    setError("")
  }

  const requestCode = async () => {
    const normalizedEmail = normalizeAuthEmail(email)

    if (!normalizedEmail) {
      setError("이메일을 입력해주세요.")
      return
    }
    if (!isValidAuthEmail(normalizedEmail)) {
      setError("이메일 형식을 확인해주세요.")
      return
    }

    setChallengeId("")
    setCode("")
    setChallengeExpiresAt(null)
    setRemainingSeconds(null)
    setStep("verify")
    setPhase("requesting")
    setStatusMessage("인증 코드를 전송하고 있습니다.")
    try {
      updateSavedEmail(normalizedEmail, saveEmail)
      const requestBody: AdminEmailCodeRequest = {
        email: normalizedEmail,
        rememberMe: keepSignedIn,
      }
      const response = await apiFetch<AdminEmailChallengeResponse>(
        "/member/api/v1/auth/admin-email/request",
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      )
      const nextChallengeId = response.data?.challengeId?.trim() || ""
      const nextExpiresInSeconds = response.data?.expiresInSeconds
      if (
        !nextChallengeId ||
        typeof nextExpiresInSeconds !== "number" ||
        nextExpiresInSeconds <= 0
      ) {
        throw new Error("Invalid administrator email challenge response.")
      }

      setEmail(normalizedEmail)
      setChallengeId(nextChallengeId)
      setCode("")
      const normalizedExpiresInSeconds = Math.ceil(nextExpiresInSeconds)
      setRemainingSeconds(normalizedExpiresInSeconds)
      setChallengeExpiresAt(Date.now() + normalizedExpiresInSeconds * 1_000)
      setStatusMessage("인증 코드를 보냈습니다.")
      setPhase("idle")
    } catch (requestError) {
      setError(
        toAuthErrorMessage(
          "adminEmailRequest",
          requestError,
          "인증 코드를 전송하지 못했습니다."
        )
      )
      setStep("request")
      setChallengeId("")
      setChallengeExpiresAt(null)
      setRemainingSeconds(null)
      setStatusMessage("")
      setPhase("idle")
    }
  }

  const verifyCode = async () => {
    if (!challengeId || challengeExpiresAt === null) {
      resetChallenge()
      setError("새 인증 코드를 요청해주세요.")
      return
    }
    if (challengeExpiresAt <= Date.now() || remainingSeconds === 0) {
      setRemainingSeconds(0)
      setError("인증 코드가 만료되었습니다. 새 코드를 요청해주세요.")
      return
    }
    if (!/^\d{8}$/.test(code)) {
      setError("8자리 인증 코드를 입력해주세요.")
      return
    }

    setPhase("verifying")
    setStatusMessage("인증 코드를 확인하고 있습니다.")
    try {
      const requestBody: AdminEmailCodeVerifyRequest = { challengeId, code }
      await apiFetch("/member/api/v1/auth/admin-email/verify", {
        method: "POST",
        body: JSON.stringify(requestBody),
      })

      let member: AuthMember
      try {
        member = await apiFetch<AuthMember>("/member/api/v1/auth/session")
      } catch {
        try {
          await apiFetch("/member/api/v1/auth/logout", { method: "DELETE" })
        } catch {
          resetChallenge()
          setError("관리자 세션을 종료하지 못했습니다. 새 코드를 요청해주세요.")
          return
        }
        resetChallenge()
        setError("관리자 세션을 확인하지 못했습니다. 새 코드를 요청해주세요.")
        return
      }

      if (member.isAdmin !== true) {
        try {
          await apiFetch("/member/api/v1/auth/logout", { method: "DELETE" })
        } catch {
          resetChallenge()
          setError(
            "비관리자 세션을 종료하지 못했습니다. 새 코드를 요청해주세요."
          )
          return
        }
        resetChallenge()
        setError("관리자 권한이 필요한 페이지입니다.")
        return
      }

      setStatusMessage("관리자 페이지를 열고 있습니다.")
      setPhase("navigating")
      window.location.assign(destination)
    } catch (verifyError) {
      setError(
        toAuthErrorMessage(
          "adminEmailVerify",
          verifyError,
          "인증 코드를 확인하지 못했습니다."
        )
      )
      setStatusMessage("")
      setPhase("idle")
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (step === "request") {
      await requestCode()
      return
    }
    await verifyCode()
  }

  const isBusy = phase !== "idle"
  const isChallengeExpired =
    step === "verify" && Boolean(challengeId) && remainingSeconds === 0
  const isVerificationUnavailable =
    step === "verify" &&
    (!challengeId || remainingSeconds === null || isChallengeExpired)
  const displayedError = isChallengeExpired
    ? "인증 코드가 만료되었습니다. 새 코드를 요청해주세요."
    : error
  const submitLabel =
    phase === "requesting"
      ? "전송 중..."
      : phase === "verifying"
      ? "확인 중..."
      : phase === "navigating"
      ? "관리자 페이지 여는 중..."
      : step === "request"
      ? "인증 코드 받기"
      : isChallengeExpired
      ? "인증 코드 만료됨"
      : "로그인"

  return (
    <LoginSection aria-labelledby="admin-login-title">
      <LoginPanel>
        <LoginHeading id="admin-login-title">관리자 로그인</LoginHeading>
        <LoginForm onSubmit={onSubmit}>
          <LoginFields
            aria-busy={isBusy}
            aria-label="관리자 로그인 입력"
            role="group"
          >
            <LoginField>
              <span>이메일</span>
              <LoginInput
                autoComplete="email"
                disabled={!hydrated || isBusy || step === "verify"}
                onChange={(event) => {
                  setEmail(event.target.value)
                  updateSavedEmail(event.target.value, saveEmail)
                }}
                type="email"
                value={email}
              />
            </LoginField>
            <LoginStage key={step}>
              {step === "request" ? (
                <>
                  <LoginPreference>
                    <input
                      checked={saveEmail}
                      disabled={!hydrated || isBusy}
                      onChange={(event) => {
                        setSaveEmail(event.target.checked)
                        updateSavedEmail(email, event.target.checked)
                      }}
                      type="checkbox"
                    />
                    <span>아이디 저장</span>
                  </LoginPreference>
                  <LoginPreference>
                    <input
                      checked={keepSignedIn}
                      disabled={!hydrated || isBusy}
                      onChange={(event) =>
                        setKeepSignedIn(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>로그인 유지</span>
                  </LoginPreference>
                </>
              ) : (
                <>
                  <LoginField>
                    <LoginFieldHeading>
                      <span>인증 코드</span>
                      <LoginTimer aria-label="남은 시간" role="timer">
                        {formatRemainingTime(remainingSeconds)}
                      </LoginTimer>
                    </LoginFieldHeading>
                    <LoginInput
                      aria-label="인증 코드"
                      autoFocus
                      autoComplete="one-time-code"
                      disabled={
                        !hydrated || isBusy || isVerificationUnavailable
                      }
                      inputMode="numeric"
                      key={challengeId || "pending"}
                      onChange={(event) =>
                        setCode(
                          event.target.value.replace(/\D/g, "").slice(0, 8)
                        )
                      }
                      value={code}
                    />
                  </LoginField>
                  <LoginSecondaryButton
                    disabled={!hydrated || isBusy}
                    onClick={resetChallenge}
                    type="button"
                  >
                    이메일 다시 입력
                  </LoginSecondaryButton>
                </>
              )}
            </LoginStage>
          </LoginFields>
          {statusMessage ? (
            <LoginStatus aria-live="polite">{statusMessage}</LoginStatus>
          ) : null}
          {displayedError ? (
            <LoginError role="alert">{displayedError}</LoginError>
          ) : null}
          <LoginSubmit
            disabled={!hydrated || isBusy || isVerificationUnavailable}
            type="submit"
          >
            {submitLabel}
          </LoginSubmit>
        </LoginForm>
      </LoginPanel>
    </LoginSection>
  )
}

export default AdminLoginPage

const LoginSection = styled.section`
  display: grid;
  min-height: 100dvh;
  padding: 1.5rem;
  place-items: center;
`

const LoginPanel = styled.div`
  width: min(100%, 26rem);
  padding: 2rem;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.gray1};
`

const LoginHeading = styled.h1`
  margin: 0;
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 1.5rem;
`

const LoginForm = styled.form`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
`

const LoginFields = styled.div`
  display: grid;
  gap: 1rem;
`

const LoginStage = styled.div`
  display: grid;
  align-content: start;
  gap: 1rem;
  min-height: 7.5rem;
  animation: admin-login-stage-enter 160ms ease-out;

  @keyframes admin-login-stage-enter {
    from {
      opacity: 0;
      transform: translateY(0.25rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const LoginField = styled.label`
  display: grid;
  gap: 0.45rem;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
  font-weight: 650;
`

const LoginFieldHeading = styled.span`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
`

const LoginTimer = styled.span`
  color: ${({ theme }) => theme.colors.gray12};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
`

const LoginInput = styled.input`
  width: 100%;
  min-height: 2.75rem;
  box-sizing: border-box;
  padding: 0.65rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.gray7};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.gray1};
  color: ${({ theme }) => theme.colors.gray12};

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.blue5};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.65;
  }
`

const LoginError = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.red11};
  font-size: 0.9rem;
`

const LoginStatus = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
  line-height: 1.5;
`

const LoginPreference = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
`

const LoginSecondaryButton = styled.button`
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.gray7};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.gray1};
  color: ${({ theme }) => theme.colors.gray11};
  font: inherit;

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.blue5};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`

const LoginSubmit = styled.button`
  min-height: 2.75rem;
  border: 0;
  border-radius: 8px;
  background: ${({ theme }) => theme.publicDesign.accent};
  color: ${({ theme }) => theme.colors.gray1};
  font: inherit;
  font-weight: 700;

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.blue5};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`
