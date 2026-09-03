export const AUTH_EMAIL_MAX_LENGTH = 320

const AUTH_EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

export const normalizeAuthEmail = (value: string) => value.trim().toLowerCase()

export const isValidAuthEmail = (value: string) => {
  const normalized = normalizeAuthEmail(value)
  if (!normalized || normalized.length > AUTH_EMAIL_MAX_LENGTH) return false
  return AUTH_EMAIL_REGEX.test(normalized)
}
