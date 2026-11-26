import { EditorState, StateEffect, StateField } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type { SiteLanguage } from "src/libs/language"
export type { SiteLanguage }

export const setEditorLanguage = StateEffect.define<SiteLanguage>()

export const editorLanguageField = StateField.define<SiteLanguage>({
  create: () => "ko",
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setEditorLanguage)) return effect.value
    }
    return value
  },
})

export const resolveEditorViewLanguage = (
  view?: EditorView | { state?: { field?: EditorState["field"] } },
  fallback: SiteLanguage = "ko"
): SiteLanguage => {
  try {
    return (view?.state?.field?.(editorLanguageField, false) as SiteLanguage | undefined) ?? fallback
  } catch {
    return fallback
  }
}
