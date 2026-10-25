export const dedupeStrings = (items: string[]): string[] => {
  if (items.length === 0) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}
