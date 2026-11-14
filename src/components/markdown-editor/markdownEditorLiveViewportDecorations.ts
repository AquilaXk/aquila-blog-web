/**
 * CodeMirror 6 뷰포트 기반 인라인/블록 데코레이션 분리 모듈.
 *
 * 참조 구현:
 * - CodeMirror 6 `@codemirror/view` (`ViewPlugin.fromClass`, `view.visibleRanges`),
 *   MIT License, https://github.com/codemirror/view
 * - SilverBullet (`silverbulletmd/silverbullet`, `client/codemirror/decoration_regions.ts`),
 *   MIT License (`markdownEditorLiveDecorationRegions.ts` 경유)
 */
import { syntaxTree } from "@codemirror/language"
import { StateField, type EditorState, type Range, type Text } from "@codemirror/state"
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate,
} from "@codemirror/view"
import {
  mergeSortedDirtyRegions,
  type DecorationRangeSpec,
} from "./markdownEditorLiveDecorationRegions"
import type { MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import {
  canReuseSelectionDecorations,
  compositionField,
  editorModeField,
  getCachedDocBlocks,
  hasAnyDocBlockWidgets,
  hasRelevantDecorationEffect,
  haveSameActiveWatchHits,
  pointerSelectingField,
  resolveScopedDecorations,
  tryIncrementalDecorationSetUpdate,
  type CachedDocBlocksEntry,
  type DecorationBuildOptions,
} from "./markdownEditorLiveSurfaceDecorations"

export const VIEWPORT_OVERSCAN_CHARS = 1536

const BLOCK_ONLY_BUILD_OPTIONS: DecorationBuildOptions = {
  includeBlocks: true,
  includeInline: false,
  disallowMultilineReplace: false,
}

const INLINE_VIEWPORT_BUILD_OPTIONS: DecorationBuildOptions = {
  includeBlocks: false,
  includeInline: true,
  disallowMultilineReplace: true,
}

export const expandVisibleRangesToDocLines = (
  doc: Text,
  visibleRanges: readonly DecorationRangeSpec[],
  overscan = VIEWPORT_OVERSCAN_CHARS
): DecorationRangeSpec[] => {
  if (doc.length === 0 || visibleRanges.length === 0) return []
  const expanded: DecorationRangeSpec[] = []
  for (let i = 0; i < visibleRanges.length; i += 1) {
    const range = visibleRanges[i]!
    const clampedFrom = Math.max(0, Math.min(doc.length, range.from - overscan))
    const clampedTo = Math.max(clampedFrom, Math.min(doc.length, range.to + overscan))
    expanded.push({
      from: doc.lineAt(clampedFrom).from,
      to: doc.lineAt(clampedTo).to,
    })
  }
  return mergeSortedDirtyRegions(expanded)
}

export const resolveBlockDecorationsInScope = (
  state: EditorState,
  blocks: CachedDocBlocksEntry,
  currentMode: MarkdownEditorSurfaceMode,
  targetRegions?: readonly DecorationRangeSpec[]
): Range<Decoration>[] =>
  resolveScopedDecorations(state, blocks, currentMode, targetRegions, BLOCK_ONLY_BUILD_OPTIONS)

export const resolveInlineDecorationsInScope = (
  state: EditorState,
  blocks: CachedDocBlocksEntry,
  currentMode: MarkdownEditorSurfaceMode,
  targetRegions: readonly DecorationRangeSpec[]
): Range<Decoration>[] =>
  resolveScopedDecorations(state, blocks, currentMode, targetRegions, INLINE_VIEWPORT_BUILD_OPTIONS)

const buildBlockDecorations = (state: EditorState, prevDecorations?: DecorationSet): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source" || state.doc.length === 0) {
    return prevDecorations && prevDecorations.size === 0 ? prevDecorations : Decoration.none
  }
  const blocks = getCachedDocBlocks(state)
  if (!hasAnyDocBlockWidgets(blocks)) {
    return prevDecorations && prevDecorations.size === 0 ? prevDecorations : Decoration.none
  }
  return Decoration.set(resolveBlockDecorationsInScope(state, blocks, currentMode), true)
}

const canReuseBlockSelectionDecorations = (startState: EditorState, nextState: EditorState): boolean => {
  if ((nextState.field(editorModeField, false) ?? "live") === "reading") return true
  const isComposing =
    (nextState.field(compositionField, false) ?? false) || (startState.field(compositionField, false) ?? false)
  if (isComposing) return false
  const blockGroups = getCachedDocBlocks(nextState).blockGroups
  for (let i = 0; i < blockGroups.length; i += 1) {
    if (!haveSameActiveWatchHits(blockGroups[i]!, startState.selection.ranges, nextState.selection.ranges)) {
      return false
    }
  }
  return true
}

export const blockDecorationField = StateField.define<DecorationSet>({
  create: (state) => buildBlockDecorations(state),
  update: (decorations, transaction) => {
    if ((transaction.state.field(pointerSelectingField, false) ?? false) && !transaction.docChanged) {
      return decorations.map(transaction.changes)
    }
    const hasRelevantEffect = hasRelevantDecorationEffect(transaction.effects)
    const treeChanged = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
    if (!transaction.docChanged && !treeChanged && !hasRelevantEffect) {
      if (!transaction.selection || canReuseBlockSelectionDecorations(transaction.startState, transaction.state)) {
        return decorations
      }
    }
    if (!transaction.docChanged && !transaction.selection && !treeChanged && !hasRelevantEffect) {
      return decorations.map(transaction.changes)
    }
    const incremental = !hasRelevantEffect
      ? tryIncrementalDecorationSetUpdate(decorations, transaction, treeChanged, resolveBlockDecorationsInScope)
      : null
    return incremental ?? buildBlockDecorations(transaction.state, decorations)
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const buildInlineViewportDecorations = (
  state: EditorState,
  visibleRanges: readonly DecorationRangeSpec[]
): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source" || state.doc.length === 0) return Decoration.none
  const mergedVisibleRegions = expandVisibleRangesToDocLines(state.doc, visibleRanges, VIEWPORT_OVERSCAN_CHARS)
  if (mergedVisibleRegions.length === 0) return Decoration.none
  const blocks = getCachedDocBlocks(state)
  return Decoration.set(resolveInlineDecorationsInScope(state, blocks, currentMode, mergedVisibleRegions), true)
}

class LiveInlineViewportPlugin implements PluginValue {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildInlineViewportDecorations(view.state, view.visibleRanges)
  }

  update(update: ViewUpdate): void {
    const hasRelevantEffect = update.transactions.some((tr) => hasRelevantDecorationEffect(tr.effects))
    if (
      (update.state.field(pointerSelectingField, false) ?? false) &&
      !update.docChanged &&
      !update.viewportChanged &&
      !hasRelevantEffect
    ) {
      this.decorations = this.decorations.map(update.changes)
      return
    }
    const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state)
    if (
      !update.docChanged &&
      !update.viewportChanged &&
      !treeChanged &&
      !hasRelevantEffect &&
      (!update.selectionSet || canReuseSelectionDecorations(update.startState, update.state))
    ) {
      return
    }
    this.decorations = buildInlineViewportDecorations(update.view.state, update.view.visibleRanges)
  }
}

export const liveInlineViewportPlugin = ViewPlugin.fromClass(LiveInlineViewportPlugin, {
  decorations: (value) => value.decorations,
})
