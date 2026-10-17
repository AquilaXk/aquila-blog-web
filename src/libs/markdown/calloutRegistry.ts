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

const calloutByBlockquoteToken = new Map<string, ResolvedCallout>(
  calloutKinds.flatMap((kind) => {
    const callout = getCallout(kind)
    return [callout.blockquoteToken, ...callout.aliases].map(
      (token): [string, ResolvedCallout] => [token, { kind, callout }]
    )
  })
)

export const resolveCalloutBlockquote = (token: string) => calloutByBlockquoteToken.get(token.toUpperCase())

export const resolveCalloutLegacyEmoji = (line: string) => {
  for (const kind of calloutKinds) {
    const callout = getCallout(kind)
    const emoji = callout.legacyEmoji.find((candidate) => line === candidate || line.startsWith(`${candidate} `))
    if (emoji) return { kind, callout, emoji }
  }
  return undefined
}
