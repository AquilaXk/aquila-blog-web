// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/login-03/{page.tsx,components/login-form.tsx} (MIT) & TryGhost/Ghost apps/admin/src/auth/{auth-layout.tsx,signin.tsx,signin-verify.tsx} (MIT)
import type { components } from "@shared/contracts"
import type { GetServerSideProps, NextPage } from "next"
import { useRouter } from "next/router"
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CONFIG } from "site.config"
import { apiFetch } from "src/apis/backend/client"
import { toAuthErrorMessage } from "src/apis/backend/errorMessages"
import BrandLogoMark from "src/components/branding/BrandMark"
import AppIcon from "src/routes/Admin/AdminAppIcon"
import type { AuthMember } from "src/hooks/useAuthSession"
import { useLanguage } from "src/libs/language"
import { adminT } from "src/routes/Admin/adminI18n"
import { clearAllAdminEditorLocalDrafts } from "src/libs/privacy/browserStorageRegistry"
import { normalizeAdminNextPath } from "src/libs/router"
import { fetchServerAdminSession } from "src/libs/server/authSession"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import { isValidAuthEmail, normalizeAuthEmail } from "src/libs/validation/auth"
import {
  formatRemainingTime,
  LOGIN_PREF_KEEP_SIGNED_IN,
  LOGIN_PREF_SAVE_EMAIL,
  normalizeCodeInput,
  persistSavedAdminEmail,
  readSavedAdminEmail,
  type LoginPhase,
  type LoginStep,
} from "src/routes/Admin/AdminLoginModel"
import {
  LoginBackLink,
  LoginBrandBanner,
  LoginBrandHeader,
  LoginBrandOrb,
  LoginError,
  LoginField,
  LoginFieldHeading,
  LoginFieldHint,
  LoginFields,
  LoginFooterRow,
  LoginForm,
  LoginHeading,
  LoginHeadingGroup,
  LoginInlineLink,
  LoginInput,
  LoginLabel,
  LoginPanel,
  LoginPreference,
  LoginPreferencesRow,
  LoginSection,
  LoginStack,
  LoginStage,
  LoginStatus,
  LoginSubmit,
  LoginSubtitle,
} from "src/routes/Admin/AdminLogin.styles"

type AdminLoginPageProps = {
  nextPath: string
}

type AdminEmailCodeRequest = components["schemas"]["AdminEmailCodeRequest"]
type AdminEmailCodeVerifyRequest =
  components["schemas"]["AdminEmailCodeVerifyRequest"]
type AdminEmailChallengeResponse =
  components["schemas"]["RsDataAdminEmailCodeRequestResBody"]

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
  const { language } = useLanguage()
  const destination = useMemo(
    () => normalizeAdminNextPath(router.query.next, nextPath),
    [nextPath, router.query.next]
  )
  const [email, setEmail] = useState("")
  const [loginPrefMask, setLoginPrefMask] = useState(0)
  const saveEmail = (loginPrefMask & LOGIN_PREF_SAVE_EMAIL) !== 0
  const keepSignedIn = (loginPrefMask & LOGIN_PREF_KEEP_SIGNED_IN) !== 0
  const setSaveEmail = useCallback(
    (v: boolean) =>
      setLoginPrefMask((m) =>
        v ? m | LOGIN_PREF_SAVE_EMAIL : m & ~LOGIN_PREF_SAVE_EMAIL
      ),
    []
  )
  const setKeepSignedIn = useCallback(
    (v: boolean) =>
      setLoginPrefMask((m) =>
        v ? m | LOGIN_PREF_KEEP_SIGNED_IN : m & ~LOGIN_PREF_KEEP_SIGNED_IN
      ),
    []
  )
  const [step, setStep] = useState<LoginStep>("request")
  const [challengeId, setChallengeId] = useState("")
  const [code, setCode] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<LoginPhase>("idle")
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number | null>(
    null
  )
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0)

  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const codeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldownSeconds((sec) => Math.max(0, sec - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldownSeconds])

  useEffect(() => {
    const savedEmail = readSavedAdminEmail()
    if (savedEmail) {
      setEmail(savedEmail)
      setLoginPrefMask((m) => m | LOGIN_PREF_SAVE_EMAIL)
    }
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

  const resetChallenge = () => {
    setPhase("idle")
    setStep("request")
    setChallengeId("")
    setCode("")
    setChallengeExpiresAt(null)
    setRemainingSeconds(null)
    setResendCooldownSeconds(0)
    setStatusMessage("")
    setError("")
    requestAnimationFrame(() => emailInputRef.current?.focus())
  }

  const requestCode = async () => {
    const normalizedEmail = normalizeAuthEmail(email)

    if (!normalizedEmail) {
      setError(adminT("loginEmailRequired", language))
      emailInputRef.current?.focus()
      return
    }
    if (!isValidAuthEmail(normalizedEmail)) {
      setError(adminT("loginInvalidEmail", language))
      emailInputRef.current?.focus()
      return
    }

    setError("")
    setChallengeId("")
    setCode("")
    setChallengeExpiresAt(null)
    setRemainingSeconds(null)
    setPhase("requesting")
    setStatusMessage(adminT("loginSendingCode", language))
    try {
      persistSavedAdminEmail(normalizedEmail, saveEmail)
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
      setStep("verify")
      setStatusMessage(adminT("loginCodeSent", language))
      setResendCooldownSeconds(60)
      setPhase("idle")
    } catch (requestError) {
      setError(
        toAuthErrorMessage(
          "adminEmailRequest",
          requestError,
          language === "en"
            ? "Failed to send verification code."
            : "인증 코드를 전송하지 못했습니다."
        )
      )
      setStep("request")
      setChallengeId("")
      setChallengeExpiresAt(null)
      setRemainingSeconds(null)
      setStatusMessage("")
      setPhase("idle")
      emailInputRef.current?.focus()
    }
  }

  const verifyCode = async () => {
    if (!challengeId || challengeExpiresAt === null) {
      resetChallenge()
      setError(adminT("loginRequestCodeFirst", language))
      return
    }
    if (challengeExpiresAt <= Date.now() || remainingSeconds === 0) {
      setRemainingSeconds(0)
      setError(adminT("loginCodeExpired", language))
      return
    }
    if (!/^\d{8}$/.test(code)) {
      setError(adminT("loginCodeRequired8Digits", language))
      codeInputRef.current?.focus()
      return
    }

    setPhase("verifying")
    setStatusMessage(adminT("loginCheckingCode", language))
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
          setError(adminT("loginSessionTerminateFailed", language))
          return
        } finally {
          clearAllAdminEditorLocalDrafts()
        }
        resetChallenge()
        setError(adminT("loginSessionVerifyFailed", language))
        return
      }

      if (member.isAdmin !== true) {
        try {
          await apiFetch("/member/api/v1/auth/logout", { method: "DELETE" })
        } catch {
          resetChallenge()
          setError(adminT("loginNonAdminSessionFailed", language))
          return
        } finally {
          clearAllAdminEditorLocalDrafts()
        }
        resetChallenge()
        setError(adminT("loginAdminRequired", language))
        return
      }

      setStatusMessage(adminT("loginOpeningAdmin", language))
      setPhase("navigating")
      window.location.assign(destination)
    } catch (verifyError) {
      setError(
        toAuthErrorMessage(
          "adminEmailVerify",
          verifyError,
          language === "en"
            ? "Failed to verify code."
            : "인증 코드를 확인하지 못했습니다."
        )
      )
      setStatusMessage("")
      setPhase("idle")
      codeInputRef.current?.focus()
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
    ? adminT("loginCodeExpired", language)
    : error
  const hasRequestError = Boolean(displayedError) && step === "request"
  const hasVerifyError = Boolean(displayedError) && step === "verify"

  const submitLabel =
    phase === "verifying"
      ? adminT("loginVerifying", language)
      : phase === "navigating"
      ? adminT("loginNavigating", language)
      : step === "request"
      ? adminT("loginSubmitRequest", language)
      : isChallengeExpired
      ? adminT("loginSubmitExpired", language)
      : adminT("loginSubmitVerify", language)

  const describedByVerify = [
    "admin-login-otp-hint",
    hasVerifyError ? "admin-login-error" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <LoginSection aria-labelledby="admin-login-title">
      <LoginStack>
        <LoginBrandBanner>
          <LoginBrandOrb aria-hidden="true">
            <BrandLogoMark className="brandLogoMark" priority />
          </LoginBrandOrb>
          <span>{CONFIG.blog.title}</span>
        </LoginBrandBanner>

        <LoginPanel>
          <LoginBrandHeader>
            <LoginHeadingGroup>
              <LoginHeading id="admin-login-title">
                {adminT("loginTitle", language)}
              </LoginHeading>
              <LoginSubtitle>
                {step === "request"
                  ? adminT("loginSubtitleRequest", language)
                  : adminT("loginSubtitleVerify", language)}
              </LoginSubtitle>
            </LoginHeadingGroup>
          </LoginBrandHeader>

          <LoginForm onSubmit={onSubmit} noValidate>
            <LoginFields
              aria-busy={isBusy}
              aria-label={adminT("loginFieldsAria", language)}
              role="group"
            >
              <LoginField>
                <LoginLabel htmlFor="admin-login-email">
                  {adminT("loginEmail", language)}
                </LoginLabel>
                <LoginInput
                  ref={emailInputRef}
                  id="admin-login-email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="admin@example.com"
                  aria-invalid={hasRequestError ? "true" : "false"}
                  aria-describedby={hasRequestError ? "admin-login-error" : undefined}
                  disabled={isBusy || step === "verify"}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (error) setError("")
                    persistSavedAdminEmail(event.target.value, saveEmail)
                  }}
                  type="email"
                  value={email}
                />
              </LoginField>

              <LoginStage key={step}>
                {step === "request" ? (
                  <LoginPreferencesRow>
                    <LoginPreference>
                      <input
                        checked={saveEmail}
                        disabled={isBusy}
                        onChange={(event) => {
                          setSaveEmail(event.target.checked)
                          persistSavedAdminEmail(email, event.target.checked)
                        }}
                        type="checkbox"
                      />
                      <span>{adminT("loginSaveEmail", language)}</span>
                    </LoginPreference>
                    <LoginPreference>
                      <input
                        checked={keepSignedIn}
                        disabled={isBusy}
                        onChange={(event) =>
                          setKeepSignedIn(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{adminT("loginKeepSignedIn", language)}</span>
                    </LoginPreference>
                  </LoginPreferencesRow>
                ) : (
                  <LoginField>
                    <LoginFieldHeading>
                      <LoginLabel htmlFor="admin-login-code">
                        {adminT("loginCode", language)}
                      </LoginLabel>
                    </LoginFieldHeading>
                    <LoginInput
                      ref={codeInputRef}
                      id="admin-login-code"
                      data-otp="true"
                      autoFocus
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="\d{8}"
                      maxLength={16}
                      placeholder="00000000"
                      aria-invalid={hasVerifyError ? "true" : "false"}
                      aria-describedby={describedByVerify}
                      disabled={isBusy || isVerificationUnavailable}
                      key={challengeId || "pending"}
                      onChange={(event) => {
                        setCode(normalizeCodeInput(event.target.value))
                        if (error) setError("")
                      }}
                      onPaste={(event) => {
                        event.preventDefault()
                        const pasted = event.clipboardData.getData("text")
                        setCode(normalizeCodeInput(pasted))
                        if (error) setError("")
                      }}
                      type="text"
                      value={code}
                    />
                    <LoginFieldHint id="admin-login-otp-hint">
                      <span>{adminT("loginOtpHint", language)}</span>
                      <span
                        aria-label={adminT("loginRemainingTime", language)}
                        role="timer"
                      >
                        {formatRemainingTime(remainingSeconds)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <LoginInlineLink
                        data-inline="true"
                        disabled={isBusy}
                        onClick={resetChallenge}
                        type="button"
                      >
                        {adminT("loginReenterEmail", language)}
                      </LoginInlineLink>
                      <span aria-hidden="true">·</span>
                      <LoginInlineLink
                        data-inline="true"
                        aria-disabled={resendCooldownSeconds > 0 ? "true" : undefined}
                        disabled={isBusy}
                        onClick={() => {
                          if (resendCooldownSeconds > 0) return
                          void requestCode()
                        }}
                        type="button"
                      >
                        {resendCooldownSeconds > 0
                          ? `${adminT("loginResendCode", language)} (${resendCooldownSeconds}s)`
                          : adminT("loginResendCode", language)}
                      </LoginInlineLink>
                    </LoginFieldHint>
                  </LoginField>
                )}
              </LoginStage>
            </LoginFields>

            {statusMessage ? (
              <LoginStatus aria-live="polite">{statusMessage}</LoginStatus>
            ) : null}
            {displayedError ? (
              <LoginError id="admin-login-error" role="alert">
                {displayedError}
              </LoginError>
            ) : null}

            <LoginSubmit
              disabled={isBusy || isVerificationUnavailable}
              type="submit"
            >
              {submitLabel}
            </LoginSubmit>
          </LoginForm>
        </LoginPanel>

        <LoginFooterRow>
          <LoginBackLink href="/">
            <AppIcon name="arrow-left" width={14} height={14} />
            <span>{adminT("loginBackToBlog", language)}</span>
          </LoginBackLink>
        </LoginFooterRow>
      </LoginStack>
    </LoginSection>
  )
}

export default AdminLoginPage
