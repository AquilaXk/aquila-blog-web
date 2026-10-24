export const calloutRegistry = {
  tip: {
    blockquoteToken: "TIP",
    aliases: ["HINT", "SUCCESS", "CHECK", "DONE"],
    marker: "T",
    legacyEmoji: ["💡", "✨"],
  },
  info: {
    blockquoteToken: "INFO",
    aliases: ["NOTE", "QUESTION", "HELP", "FAQ", "TODO"],
    marker: "i",
    legacyEmoji: ["ℹ️", "ℹ"],
  },
  warning: {
    blockquoteToken: "WARNING",
    aliases: [
      "CAUTION",
      "ATTENTION",
      "FAILURE",
      "FAIL",
      "MISSING",
      "DANGER",
      "ERROR",
      "BUG",
    ],
    marker: "!",
    legacyEmoji: ["⚠️", "⚠", "🚨", "❗", "⛔"],
  },
  outline: {
    blockquoteToken: "OUTLINE",
    aliases: ["QUOTE", "CITE"],
    marker: "≡",
    legacyEmoji: ["📋", "📝", "📌", "🗒️"],
  },
  example: {
    blockquoteToken: "EXAMPLE",
    aliases: [],
    marker: "✓",
    legacyEmoji: ["✅", "✔️", "☑️"],
  },
  summary: {
    blockquoteToken: "SUMMARY",
    aliases: ["IMPORTANT", "ABSTRACT", "TLDR"],
    marker: "§",
    legacyEmoji: ["📚", "🧾"],
  },
} as const

export type CalloutKind = keyof typeof calloutRegistry

export const calloutKinds = Object.keys(calloutRegistry) as CalloutKind[]
export const defaultCalloutKind = "tip" as const
export const defaultCalloutBlockquoteToken = calloutRegistry[defaultCalloutKind].blockquoteToken

export const getCallout = (kind: CalloutKind) => calloutRegistry[kind]

type ResolvedCallout = { kind: CalloutKind; callout: (typeof calloutRegistry)[CalloutKind] }
type ResolvedLegacyEmojiCallout = ResolvedCallout & { emoji: string }

const calloutByBlockquoteToken = new Map<string, ResolvedCallout>(
  calloutKinds.flatMap((kind) => {
    const callout = getCallout(kind)
    return [callout.blockquoteToken, ...callout.aliases].map(
      (token): [string, ResolvedCallout] => [token, { kind, callout }]
    )
  })
)

const LEGACY_EMOJI_ENTRIES: ReadonlyArray<readonly [string, ResolvedLegacyEmojiCallout]> = calloutKinds
  .flatMap((kind) => {
    const callout = getCallout(kind)
    return callout.legacyEmoji.map(
      (emoji): readonly [string, ResolvedLegacyEmojiCallout] => [emoji, { kind, callout, emoji }]
    )
  })
  .sort((a, b) => b[0].length - a[0].length)

export const resolveCalloutBlockquote = (token: string) => calloutByBlockquoteToken.get(token.toUpperCase())

export const resolveCalloutLegacyEmoji = (line: string) => {
  if (!line || (line.codePointAt(0) ?? 0) < 0x80) return undefined
  for (const [emoji, entry] of LEGACY_EMOJI_ENTRIES) {
    if (line === emoji || line.startsWith(`${emoji} `)) return entry
  }
  return undefined
}

