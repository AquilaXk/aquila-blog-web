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
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

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
    setStep("request")
    setChallengeId("")
    setCode("")
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

    setLoading(true)
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
      setStep("verify")
      setStatusMessage(
        `인증 코드를 보냈습니다. ${Math.ceil(
          nextExpiresInSeconds / 60
        )}분 안에 입력해주세요.`
      )
    } catch (requestError) {
      setError(
        toAuthErrorMessage(
          "adminEmailRequest",
          requestError,
          "인증 코드를 전송하지 못했습니다."
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    if (!/^\d{8}$/.test(code)) {
      setError("8자리 인증 코드를 입력해주세요.")
      return
    }
    if (!challengeId) {
      resetChallenge()
      setError("새 인증 코드를 요청해주세요.")
      return
    }

    setLoading(true)
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

      window.location.assign(destination)
    } catch (verifyError) {
      setError(
        toAuthErrorMessage(
          "adminEmailVerify",
          verifyError,
          "인증 코드를 확인하지 못했습니다."
        )
      )
    } finally {
      setLoading(false)
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

  const submitLabel = step === "request" ? "인증 코드 받기" : "로그인"
  const loadingLabel = step === "request" ? "전송 중..." : "확인 중..."

  return (
    <LoginSection aria-labelledby="admin-login-title">
      <LoginPanel>
        <LoginHeading id="admin-login-title">관리자 로그인</LoginHeading>
        <LoginForm onSubmit={onSubmit}>
          <LoginField>
            <span>이메일</span>
            <LoginInput
              autoComplete="email"
              disabled={!hydrated || loading || step === "verify"}
              onChange={(event) => {
                setEmail(event.target.value)
                updateSavedEmail(event.target.value, saveEmail)
              }}
              type="email"
              value={email}
            />
          </LoginField>
          {step === "request" ? (
            <>
              <LoginPreference>
                <input
                  checked={saveEmail}
                  disabled={!hydrated || loading}
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
                  disabled={!hydrated || loading}
                  onChange={(event) => setKeepSignedIn(event.target.checked)}
                  type="checkbox"
                />
                <span>로그인 유지</span>
              </LoginPreference>
            </>
          ) : (
            <>
              <LoginField>
                <span>인증 코드</span>
                <LoginInput
                  autoComplete="one-time-code"
                  disabled={!hydrated || loading}
                  inputMode="numeric"
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  value={code}
                />
              </LoginField>
              <LoginSecondaryButton
                disabled={!hydrated || loading}
                onClick={resetChallenge}
                type="button"
              >
                이메일 다시 입력
              </LoginSecondaryButton>
            </>
          )}
          {statusMessage ? (
            <LoginStatus aria-live="polite">{statusMessage}</LoginStatus>
          ) : null}
          {error ? <LoginError role="alert">{error}</LoginError> : null}
          <LoginSubmit disabled={!hydrated || loading} type="submit">
            {loading ? loadingLabel : submitLabel}
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

const LoginField = styled.label`
  display: grid;
  gap: 0.45rem;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
  font-weight: 650;
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
