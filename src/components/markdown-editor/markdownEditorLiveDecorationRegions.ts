// Adapted from SilverBullet (`silverbulletmd/silverbullet`, client/codemirror/decoration_regions.ts, MIT License).
// Copyright (c) 2022 Zef Hemel / SilverBullet contributors — used under MIT terms.

import type { ChangeDesc, EditorState, Text } from "@codemirror/state"
import type { Tree } from "@lezer/common"

export type DecorationRangeSpec = {
  from: number
  to: number
}

export const MAX_DIRTY_DECORATION_SHARE = 0.5

type SortedRangeIndex = {
  cap: number
  maxTo: Int32Array
}

const rangeIndexCache = new WeakMap<readonly DecorationRangeSpec[], SortedRangeIndex>()

const buildSortedRangeIndex = (ranges: readonly DecorationRangeSpec[]): SortedRangeIndex => {
  let cap = 1
  while (cap < ranges.length) cap <<= 1
  const maxTo = new Int32Array(cap * 2)
  maxTo.fill(-1)
  for (let i = 0; i < ranges.length; i += 1) {
    maxTo[cap + i] = ranges[i]!.to
  }
  for (let i = cap - 1; i >= 1; i -= 1) {
    const left = maxTo[i << 1]!
    const right = maxTo[(i << 1) | 1]!
    maxTo[i] = left >= right ? left : right
  }
  return { cap, maxTo }
}

const getSortedRangeIndex = (ranges: readonly DecorationRangeSpec[]): SortedRangeIndex => {
  let cached = rangeIndexCache.get(ranges)
  if (!cached) {
    cached = buildSortedRangeIndex(ranges)
    rangeIndexCache.set(ranges, cached)
  }
  return cached
}

const findUpperBoundFrom = (ranges: readonly DecorationRangeSpec[], targetFrom: number): number => {
  let low = 0
  let high = ranges.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (ranges[mid]!.from <= targetFrom) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

const STACK_CAP = 64
const scratchStackNodes = new Int32Array(STACK_CAP)
const scratchStackStarts = new Int32Array(STACK_CAP)
const scratchStackEnds = new Int32Array(STACK_CAP)
let scratchStackInUse = false

export const forEachOverlappingSortedIndex = <T extends DecorationRangeSpec>(
  sortedRanges: readonly T[],
  qFrom: number,
  qTo: number,
  inclusivePoint: boolean,
  visitor: (item: T, index: number) => boolean | void
): boolean => {
  if (sortedRanges.length === 0) return true
  const isPoint = qFrom === qTo
  if (!isPoint && qFrom >= qTo) return true
  if (isPoint && !inclusivePoint) return true
  const endLimit = findUpperBoundFrom(sortedRanges, qTo)
  if (endLimit === 0) return true

  const { cap, maxTo } = getSortedRangeIndex(sortedRanges)
  const useScratch = !scratchStackInUse && cap <= 0x4000_0000
  const stackNodes = useScratch ? scratchStackNodes : []
  const stackStarts = useScratch ? scratchStackStarts : []
  const stackEnds = useScratch ? scratchStackEnds : []
  if (useScratch) scratchStackInUse = true

  let sp = 0
  stackNodes[sp] = 1
  stackStarts[sp] = 0
  stackEnds[sp] = cap
  sp += 1

  try {
    while (sp > 0) {
      sp -= 1
      const node = stackNodes[sp]!
      const nodeStart = stackStarts[sp]!
      const nodeEnd = stackEnds[sp]!
      if (nodeStart >= endLimit || nodeStart >= sortedRanges.length || maxTo[node]! < qFrom) {
        continue
      }
      if (node >= cap) {
        const idx = node - cap
        const item = sortedRanges[idx]!
        const intersects = isPoint
          ? item.from <= qFrom && qFrom <= item.to
          : item.from < qTo && qFrom < item.to
        if (intersects && visitor(item, idx) === false) {
          return false
        }
        continue
      }
      const mid = (nodeStart + nodeEnd) >>> 1
      // Push right before left so LIFO pop visits left subtree first.
      if (mid < endLimit && mid < sortedRanges.length && maxTo[(node << 1) | 1]! >= qFrom) {
        stackNodes[sp] = (node << 1) | 1
        stackStarts[sp] = mid
        stackEnds[sp] = nodeEnd
        sp += 1
      }
      if (maxTo[node << 1]! >= qFrom) {
        stackNodes[sp] = node << 1
        stackStarts[sp] = nodeStart
        stackEnds[sp] = mid
        sp += 1
      }
    }
    return true
  } finally {
    if (useScratch) scratchStackInUse = false
  }
}

export const collectUniqueSortedIndicesForRegions = <T extends DecorationRangeSpec>(
  sortedRanges: readonly T[],
  regions: readonly DecorationRangeSpec[]
): number[] => {
  if (sortedRanges.length === 0 || regions.length === 0) return []
  const seen = new Set<number>()
  for (const region of regions) {
    forEachOverlappingSortedIndex(sortedRanges, region.from, region.to, false, (_item, idx) => {
      seen.add(idx)
    })
  }
  const indices = [...seen]
  indices.sort((a, b) => a - b)
  return indices
}

export const isRangeActiveInSelections = (
  from: number,
  to: number,
  selections: readonly DecorationRangeSpec[]
): boolean => {
  for (let i = 0; i < selections.length; i += 1) {
    const sel = selections[i]!
    if (sel.from === sel.to) {
      if (sel.from >= from && sel.from <= to) return true
    } else if (sel.from < to && sel.to > from) {
      return true
    }
  }
  return false
}

export const haveSameActiveWatchHitsIndexed = (
  activeWatchRanges: readonly DecorationRangeSpec[],
  prevSelections: readonly DecorationRangeSpec[],
  nextSelections: readonly DecorationRangeSpec[]
): boolean => {
  if (activeWatchRanges.length === 0) return true
  const checkMatches = (sel: DecorationRangeSpec): boolean =>
    forEachOverlappingSortedIndex(activeWatchRanges, sel.from, sel.to, true, (range) => {
      if (
        isRangeActiveInSelections(range.from, range.to, prevSelections) !==
        isRangeActiveInSelections(range.from, range.to, nextSelections)
      ) {
        return false
      }
      return true
    })

  for (let i = 0; i < prevSelections.length; i += 1) {
    if (!checkMatches(prevSelections[i]!)) return false
  }
  for (let i = 0; i < nextSelections.length; i += 1) {
    if (!checkMatches(nextSelections[i]!)) return false
  }
  return true
}

const topLevelRegionsByTree = new WeakMap<Tree, readonly DecorationRangeSpec[]>()

export const getCachedTopLevelRegions = (tree: Tree): readonly DecorationRangeSpec[] => {
  const cached = topLevelRegionsByTree.get(tree)
  if (cached) return cached
  const regions: DecorationRangeSpec[] = []
  for (let child = tree.topNode.firstChild; child; child = child.nextSibling) {
    regions.push({ from: child.from, to: child.to })
  }
  topLevelRegionsByTree.set(tree, regions)
  return regions
}

export const collectSyntaxNodesInRanges = (
  tree: Tree,
  visibleRanges: readonly DecorationRangeSpec[],
  onEnter: (name: string, from: number, to: number) => void
): void => {
  for (const range of visibleRanges) {
    if (range.from >= range.to) continue
    tree.iterate({
      from: range.from,
      to: range.to,
      enter: (nodeRef) => {
        onEnter(nodeRef.name, nodeRef.from, nodeRef.to)
      },
    })
  }
}

export const mergeSortedDirtyRegions = (ranges: readonly DecorationRangeSpec[]): DecorationRangeSpec[] => {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to)
  const merged: DecorationRangeSpec[] = []
  for (const r of sorted) {
    const prev = merged.at(-1)
    if (prev && r.from <= prev.to) {
      if (r.to > prev.to) prev.to = r.to
    } else {
      merged.push({ from: r.from, to: r.to })
    }
  }
  return merged
}

const alignRegionToDocLines = (doc: Text, from: number, to: number): DecorationRangeSpec => {
  const safeFrom = Math.max(0, Math.min(doc.length, from))
  const safeTo = Math.max(safeFrom, Math.min(doc.length, to))
  return {
    from: doc.lineAt(safeFrom).from,
    to: doc.lineAt(safeTo).to,
  }
}

const expandSeedToTopLevelAndDocLines = (
  doc: Text,
  seed: DecorationRangeSpec,
  mappedPrevRegions: readonly DecorationRangeSpec[],
  nextRegions: readonly DecorationRangeSpec[]
): DecorationRangeSpec => {
  let minFrom = seed.from
  let maxTo = seed.to
  const absorb = (regions: readonly DecorationRangeSpec[]) => {
    for (let i = 0; i < regions.length; i += 1) {
      const r = regions[i]!
      if (r.from > maxTo) break
      if (r.to >= minFrom && r.from <= maxTo) {
        if (r.from < minFrom) minFrom = r.from
        if (r.to > maxTo) maxTo = r.to
      }
    }
  }
  absorb(mappedPrevRegions)
  absorb(nextRegions)
  return alignRegionToDocLines(doc, minFrom, maxTo)
}

export const isRangeCoveredBySortedRegions = (
  sortedRegions: readonly DecorationRangeSpec[],
  from: number,
  to: number
): boolean => {
  for (let i = 0; i < sortedRegions.length; i += 1) {
    const r = sortedRegions[i]!
    if (r.from > to) return false
    const intersects = from === to ? from >= r.from && from <= r.to : from < r.to && to > r.from
    if (intersects) return true
  }
  return false
}

export const haveIdenticalSpansOutsideRegions = (
  prevItems: readonly DecorationRangeSpec[],
  nextItems: readonly DecorationRangeSpec[],
  changes: ChangeDesc,
  dirtyRegions: readonly DecorationRangeSpec[]
): boolean => {
  const outsidePrev: DecorationRangeSpec[] = []
  for (const item of prevItems) {
    const mappedFrom = changes.mapPos(item.from, 1)
    const mappedTo = changes.mapPos(item.to, -1)
    if (!isRangeCoveredBySortedRegions(dirtyRegions, mappedFrom, mappedTo)) {
      outsidePrev.push({ from: mappedFrom, to: mappedTo })
    }
  }
  const outsideNext: DecorationRangeSpec[] = []
  for (const item of nextItems) {
    if (!isRangeCoveredBySortedRegions(dirtyRegions, item.from, item.to)) {
      outsideNext.push({ from: item.from, to: item.to })
    }
  }
  if (outsidePrev.length !== outsideNext.length) return false
  for (let i = 0; i < outsidePrev.length; i += 1) {
    if (outsidePrev[i]!.from !== outsideNext[i]!.from || outsidePrev[i]!.to !== outsideNext[i]!.to) {
      return false
    }
  }
  return true
}

export const computeDirtyRegionsForTransaction = (
  nextState: EditorState,
  prevTree: Tree,
  nextTree: Tree,
  changes: ChangeDesc,
  docChanged: boolean,
  prevSelections: readonly DecorationRangeSpec[],
  nextSelections: readonly DecorationRangeSpec[],
  nextBlockGroups: readonly (readonly DecorationRangeSpec[])[],
  prevBlockGroups: readonly (readonly DecorationRangeSpec[])[] | null
): DecorationRangeSpec[] | null => {
  if (nextState.doc.length === 0) return null

  const seeds: DecorationRangeSpec[] = []
  if (docChanged) {
    changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
      seeds.push({ from: fromB, to: toB })
    })
  }
  for (const sel of prevSelections) {
    seeds.push({
      from: changes.mapPos(sel.from, -1),
      to: changes.mapPos(sel.to, 1),
    })
  }
  for (const sel of nextSelections) {
    seeds.push({ from: sel.from, to: sel.to })
  }
  if (seeds.length === 0) return []

  const mappedPrevRegions = docChanged
    ? getCachedTopLevelRegions(prevTree).map((r) => ({
        from: changes.mapPos(r.from, 1),
        to: changes.mapPos(r.to, -1),
      }))
    : []
  const nextRegions = getCachedTopLevelRegions(nextTree)

  const expanded: DecorationRangeSpec[] = []
  for (const seed of seeds) {
    expanded.push(expandSeedToTopLevelAndDocLines(nextState.doc, seed, mappedPrevRegions, nextRegions))
  }
  let dirtyRegions = mergeSortedDirtyRegions(expanded)

  // Expand again to cover any replaced blocks (e.g. tables preceded by aq-table comments or multi-line blocks).
  const blockSeeds: DecorationRangeSpec[] = [...dirtyRegions]
  for (const group of nextBlockGroups) {
    for (const region of dirtyRegions) {
      forEachOverlappingSortedIndex(group, region.from, region.to, true, (block) => {
        blockSeeds.push(expandSeedToTopLevelAndDocLines(nextState.doc, block, mappedPrevRegions, nextRegions))
      })
    }
  }
  dirtyRegions = mergeSortedDirtyRegions(blockSeeds)

  let dirtyBytes = 0
  for (const region of dirtyRegions) dirtyBytes += region.to - region.from
  if (dirtyBytes >= nextState.doc.length * MAX_DIRTY_DECORATION_SHARE) return null

  if (docChanged && prevBlockGroups) {
    for (let g = 0; g < nextBlockGroups.length; g += 1) {
      if (!haveIdenticalSpansOutsideRegions(prevBlockGroups[g]!, nextBlockGroups[g]!, changes, dirtyRegions)) {
        return null
      }
    }
  }
  return dirtyRegions
}
