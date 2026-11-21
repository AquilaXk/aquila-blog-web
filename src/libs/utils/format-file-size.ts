export const formatFileSize = (
  bytes?: number | null,
  options?: { fallback?: string },
): string => {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return options?.fallback ?? ""
  }
  const units = ["B", "KB", "MB", "GB"] as const
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}
