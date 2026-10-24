const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
const dateTimePartsFormatterCache = new Map<string, Intl.DateTimeFormat>()

const getDateFormatter = (lang: string, timeZone: string): Intl.DateTimeFormat => {
  const key = `${lang}|${timeZone}`
  const cached = dateFormatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  })
  dateFormatterCache.set(key, formatter)
  return formatter
}

const getDateTimePartsFormatter = (lang: string, timeZone: string): Intl.DateTimeFormat => {
  const key = `${lang}|${timeZone}`
  const cached = dateTimePartsFormatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  })
  dateTimePartsFormatterCache.set(key, formatter)
  return formatter
}

export const formatDate = (
  input: string | number | Date,
  lang: string = "en-US",
  timeZone: string = "Asia/Seoul"
): string => {
  if (!input) return ""

  try {
    const date = input instanceof Date ? input : new Date(input)

    if (isNaN(date.getTime())) {
      return ""
    }

    return getDateFormatter(lang, timeZone).format(date)
  } catch {
    return ""
  }
}

const toDate = (input: string | number | Date): Date | null => {
  if (!input) return null

  try {
    const date = input instanceof Date ? input : new Date(input)
    if (Number.isNaN(date.getTime())) return null
    return date
  } catch {
    return null
  }
}

const toParts = (
  input: string | number | Date,
  lang: string,
  timeZone: string
) => {
  const date = toDate(input)
  if (!date) return null

  const formatter = getDateTimePartsFormatter(lang, timeZone)
  const parts = formatter.formatToParts(date)
  let year = ""
  let month = ""
  let day = ""
  let hour = ""
  let minute = ""

  for (const part of parts) {
    if (part.type === "year") year = part.value
    else if (part.type === "month") month = part.value
    else if (part.type === "day") day = part.value
    else if (part.type === "hour") hour = part.value
    else if (part.type === "minute") minute = part.value
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
  }
}

export const formatDateTime = (
  input: string | number | Date,
  lang: string = "ko-KR",
  timeZone: string = "Asia/Seoul"
): string => {
  const parts = toParts(input, lang, timeZone)
  if (!parts) return ""
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

export const formatShortDateTime = (
  input: string | number | Date,
  lang: string = "ko-KR",
  timeZone: string = "Asia/Seoul"
): string => {
  const parts = toParts(input, lang, timeZone)
  if (!parts) return ""
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

export const formatIsoDateTime = (value?: string, fallback: string = "-"): string => {
  if (!value) return fallback
  return value.slice(0, 16).replace("T", " ")
}
