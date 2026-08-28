import styled from "@emotion/styled"
import type { GetServerSideProps, NextPage } from "next"
import { useRouter } from "next/router"
import { type FormEvent, useMemo, useState } from "react"
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

export const getServerSideProps: GetServerSideProps<AdminLoginPageProps> = withSsrMetrics<AdminLoginPageProps>(
  "auth",
  async ({ req, query }) => {
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
  }
)

const AdminLoginPage: NextPage<AdminLoginPageProps> = ({ nextPath }) => {
  const router = useRouter()
  const destination = useMemo(
    () => normalizeAdminNextPath(router.query.next, nextPath),
    [nextPath, router.query.next]
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    const normalizedEmail = normalizeAuthEmail(email)

    if (!normalizedEmail || !password.trim()) {
      setError("이메일과 비밀번호를 입력해주세요.")
      return
    }
    if (!isValidAuthEmail(normalizedEmail)) {
      setError("이메일 형식을 확인해주세요.")
      return
    }

    setLoading(true)
    try {
      await apiFetch("/member/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      })

      let member: AuthMember & { admin?: boolean }
      try {
        member = await apiFetch<AuthMember & { admin?: boolean }>("/member/api/v1/auth/session")
      } catch {
        setError("관리자 세션을 확인하지 못했습니다. 다시 로그인해주세요.")
        return
      }

      if (!(member.isAdmin ?? member.admin ?? false)) {
        try {
          await apiFetch("/member/api/v1/auth/logout", { method: "POST" })
        } catch {
          setError("비관리자 세션을 종료하지 못했습니다. 다시 시도해주세요.")
          return
        }
        setError("관리자 권한이 필요한 페이지입니다.")
        return
      }

      window.location.assign(destination)
    } catch (authError) {
      setError(toAuthErrorMessage("login", authError, "로그인에 실패했습니다."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginSection aria-labelledby="admin-login-title">
      <LoginPanel>
        <LoginHeading id="admin-login-title">관리자 로그인</LoginHeading>
        <LoginForm onSubmit={onSubmit}>
          <LoginField>
            <span>이메일</span>
            <LoginInput
              autoComplete="email"
              disabled={loading}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </LoginField>
          <LoginField>
            <span>비밀번호</span>
            <LoginInput
              autoComplete="current-password"
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </LoginField>
          {error ? <LoginError role="alert">{error}</LoginError> : null}
          <LoginSubmit disabled={loading} type="submit">
            {loading ? "로그인 중..." : "로그인"}
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
