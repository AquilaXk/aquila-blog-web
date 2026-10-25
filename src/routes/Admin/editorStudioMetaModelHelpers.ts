export const dedupeStrings = (items: string[]): string[] => {
  if (items.length === 0) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (let i = 0; i < items.length; i += 1) {
    const trimmed = items[i].trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}
