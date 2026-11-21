// 참조 구현: TryGhost/Ghost apps/admin/src/auth/signin-verify.tsx (MIT)
import { isValidAuthEmail, normalizeAuthEmail } from "src/libs/validation/auth"

export const ADMIN_SAVED_EMAIL_STORAGE_KEY = "auth.admin.savedEmail.v1"

export const LOGIN_PREF_SAVE_EMAIL = 1
export const LOGIN_PREF_KEEP_SIGNED_IN = 1 << 1

export type LoginStep = "request" | "verify"
export type LoginPhase = "idle" | "requesting" | "verifying" | "navigating"

export const normalizeCodeInput = (raw: string): string => {
  let result = ""
  for (let i = 0; i < raw.length && result.length < 8; i++) {
    const charCode = raw.charCodeAt(i)
    if (charCode >= 48 && charCode <= 57) {
      result += raw[i]
    }
  }
  return result
}

export const formatRemainingTime = (seconds: number | null): string => {
  if (seconds === null) return "--:--"
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`
}

export const readSavedAdminEmail = (): string | null => {
  try {
    const savedEmail = window.localStorage.getItem(ADMIN_SAVED_EMAIL_STORAGE_KEY)
    return savedEmail ? normalizeAuthEmail(savedEmail) : null
  } catch {
    return null
  }
}

export const persistSavedAdminEmail = (
  value: string,
  shouldSave: boolean
): void => {
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
  } catch {}
}
