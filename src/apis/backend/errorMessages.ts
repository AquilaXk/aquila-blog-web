import { ApiError, ApiTimeoutError } from "./client"

type AuthAction =
  | "adminEmailRequest"
  | "adminEmailVerify"

const authStatusMessages: Record<
  AuthAction,
  Partial<Record<number, string>>
> = {
  adminEmailRequest: {
    400: "이메일 형식을 확인해주세요.",
    429: "인증 코드 요청이 많습니다. 잠시 후 다시 시도해주세요.",
    500: "인증 코드 전송 중 서버 오류가 발생했습니다.",
    503: "이메일 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.",
  },
  adminEmailVerify: {
    400: "인증 코드 형식을 확인해주세요.",
    401: "인증 코드가 올바르지 않거나 만료되었습니다.",
    429: "인증 코드 확인 요청이 많습니다. 잠시 후 다시 시도해주세요.",
    500: "인증 코드 확인 중 서버 오류가 발생했습니다.",
    503: "이메일 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.",
  },
}

export const toAuthErrorMessage = (
  action: AuthAction,
  error: unknown,
  fallback: string
) => {
  if (error instanceof ApiTimeoutError) {
    return "응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
  }

  if (error instanceof ApiError) {
    const mapped = authStatusMessages[action][error.status]
    if (mapped) return mapped
    return error.userMessage || fallback
  }

  return fallback
}
