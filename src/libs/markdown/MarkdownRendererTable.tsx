import {
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  TABLE_MIN_COLUMN_WIDTH_PX,
  TABLE_MIN_ROW_HEIGHT_PX,
  type MarkdownTableCellAlignment,
  type MarkdownTableCellLayout,
  type MarkdownTableLayout,
} from "src/libs/markdown/tableMetadata"

type MarkdownTableRenderContextValue = {
  headerColumn: boolean
  rowHeights: Array<number | null>
  columnAlignments: Array<MarkdownTableCellAlignment | null>
  cellLayouts: Array<Array<MarkdownTableCellLayout | null>>
}

type MarkdownTableCellPosition = {
  rowIndex: number
  columnIndex: number
}

export const TABLE_SCROLL_LEFT_BIT = 1
export const TABLE_SCROLL_HINT_BIT = 1 << 1
export const TABLE_COL_COUNT_SHIFT = 2

export const packTableUiState = (
  hasScrollLeft: boolean,
  showScrollHint: boolean,
  detectedColumnCount: number
): number => {
  const safeCols = detectedColumnCount > 0 ? Math.trunc(detectedColumnCount) : 0
  return (
    (hasScrollLeft ? TABLE_SCROLL_LEFT_BIT : 0) |
    (showScrollHint ? TABLE_SCROLL_HINT_BIT : 0) |
    (safeCols << TABLE_COL_COUNT_SHIFT)
  )
}

export const unpackTableUiState = (mask: number) => ({
  hasScrollLeft: (mask & TABLE_SCROLL_LEFT_BIT) !== 0,
  showScrollHint: (mask & TABLE_SCROLL_HINT_BIT) !== 0,
  detectedColumnCount: mask >>> TABLE_COL_COUNT_SHIFT,
})

const MarkdownTableRenderContext = createContext<MarkdownTableRenderContextValue | null>(null)
const MarkdownTableRowIndexContext = createContext<number>(0)
const MarkdownTableCellPositionContext = createContext<MarkdownTableCellPosition | null>(null)

const isTableSectionElement = (
  element: ReactElement
): element is ReactElement<{ children?: ReactNode }> =>
  element.type === "thead" || element.type === "tbody" || element.type === "tfoot"

const countRowElementCells = (rowNode: ReactNode): number => {
  if (!isValidElement<{ children?: ReactNode }>(rowNode)) return 0
  let count = 0
  Children.forEach(rowNode.props.children, (cellNode) => {
    if (isValidElement(cellNode)) {
      count += 1
    }
  })
  return count
}

const countRenderedTableColumns = (children: ReactNode): number => {
  let maxCols = 0
  Children.forEach(children, (sectionNode) => {
    if (!isValidElement<{ children?: ReactNode }>(sectionNode)) return
    if (isTableSectionElement(sectionNode)) {
      Children.forEach(sectionNode.props.children, (rowNode) => {
        const cols = countRowElementCells(rowNode)
        if (cols > maxCols) maxCols = cols
      })
      return
    }
    const cols = countRowElementCells(sectionNode)
    if (cols > maxCols) maxCols = cols
  })
  return maxCols
}

const provideIndexedTableRows = (children: ReactNode): ReactNode => {
  let nextRowIndex = 0
  return Children.map(children, (sectionOrRowChild) => {
    if (!isValidElement(sectionOrRowChild)) return sectionOrRowChild
    if (isTableSectionElement(sectionOrRowChild)) {
      const wrappedRows = Children.map(sectionOrRowChild.props.children, (rowChild) => {
        if (!isValidElement(rowChild)) return rowChild
        const assignedRowIndex = nextRowIndex
        nextRowIndex += 1
        return createElement(
          MarkdownTableRowIndexContext.Provider,
          { value: assignedRowIndex },
          rowChild
        )
      })
      return cloneElement(sectionOrRowChild, undefined, wrappedRows)
    }
    const assignedRowIndex = nextRowIndex
    nextRowIndex += 1
    return createElement(
      MarkdownTableRowIndexContext.Provider,
      { value: assignedRowIndex },
      sectionOrRowChild
    )
  })
}

const computeNormalizedColumnWidths = (columnWidths: Array<number | null> | undefined) => {
  if (!columnWidths || columnWidths.length === 0) {
    return {
      normalizedColumnWidths: [] as Array<number | null>,
      explicitTableWidth: 0,
      hasExplicitColumnWidths: false,
    }
  }
  const widths = new Array<number | null>(columnWidths.length)
  let totalWidth = 0
  let hasExplicit = false
  for (let index = 0; index < columnWidths.length; index += 1) {
    const width = columnWidths[index]
    if (typeof width === "number" && Number.isFinite(width) && width > 0) {
      const normalized = Math.max(TABLE_MIN_COLUMN_WIDTH_PX, Math.round(width))
      widths[index] = normalized
      totalWidth += normalized
      hasExplicit = true
    } else {
      widths[index] = null
    }
  }
  return {
    normalizedColumnWidths: widths,
    explicitTableWidth: totalWidth,
    hasExplicitColumnWidths: hasExplicit,
  }
}

const resolveTableInlineStyle = ({
  hasAllExplicitColumnWidths,
  explicitTableWidth,
  isFitWidthTable,
  isWideOverflowTable,
}: {
  hasAllExplicitColumnWidths: boolean
  explicitTableWidth: number
  isFitWidthTable: boolean
  isWideOverflowTable: boolean
}): CSSProperties | undefined => {
  if (isFitWidthTable) {
    return {
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
      tableLayout: "fixed",
    }
  }
  if (hasAllExplicitColumnWidths && explicitTableWidth > 0) {
    return {
      width: `${explicitTableWidth}px`,
      minWidth: `${explicitTableWidth}px`,
    }
  }
  if (!isWideOverflowTable) {
    return {
      width: "100%",
      maxWidth: "none",
    }
  }
  return undefined
}

const resolveTableColInlineStyle = (
  width: number | null,
  isFitWidthTable: boolean,
  hasAllExplicitColumnWidths: boolean,
  explicitTableWidth: number
): CSSProperties | undefined => {
  if (!width) return undefined
  if (isFitWidthTable && hasAllExplicitColumnWidths && explicitTableWidth > 0) {
    return { width: `${((width / explicitTableWidth) * 100).toFixed(4)}%` }
  }
  if (isFitWidthTable) {
    return { width: `${width}px` }
  }
  return { width: `${width}px`, minWidth: `${width}px` }
}

const bindTableScrollMetricsObserver = (
  scrollElement: HTMLDivElement,
  setTableUiMask: (updater: (prev: number) => number) => void
) => {
  const tableElement = scrollElement.querySelector("table")

  const computeScrollFlags = () => {
    const overflowAmount = scrollElement.scrollWidth - scrollElement.clientWidth
    const remaining = overflowAmount - scrollElement.scrollLeft
    return {
      nextScrollLeft: scrollElement.scrollLeft > 2,
      nextScrollHint: overflowAmount > 1 && remaining > 1,
    }
  }

  const syncScrollHint = () => {
    const { nextScrollLeft, nextScrollHint } = computeScrollFlags()
    setTableUiMask((prev) =>
      packTableUiState(nextScrollLeft, nextScrollHint, prev >>> TABLE_COL_COUNT_SHIFT)
    )
  }

  const syncTableMetrics = () => {
    const domCols = tableElement?.querySelector("tr")?.children.length ?? 0
    const { nextScrollLeft, nextScrollHint } = computeScrollFlags()
    setTableUiMask((prev) => {
      const prevCols = prev >>> TABLE_COL_COUNT_SHIFT
      return packTableUiState(nextScrollLeft, nextScrollHint, domCols > 0 ? domCols : prevCols)
    })
  }

  syncTableMetrics()
  scrollElement.addEventListener("scroll", syncScrollHint, { passive: true })
  window.addEventListener("resize", syncTableMetrics)

  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncTableMetrics()) : null
  resizeObserver?.observe(scrollElement)
  if (resizeObserver && tableElement) resizeObserver.observe(tableElement)

  return () => {
    scrollElement.removeEventListener("scroll", syncScrollHint)
    window.removeEventListener("resize", syncTableMetrics)
    resizeObserver?.disconnect()
  }
}

const toOptionalTrueAttr = (flag: boolean): "true" | undefined => (flag ? "true" : undefined)

const buildTableElementAttributes = ({
  className,
  isWideOverflowTable,
  isFitWidthTable,
  isNarrowTable,
  layout,
}: {
  className?: string
  isWideOverflowTable: boolean
  isFitWidthTable: boolean
  isNarrowTable: boolean
  layout?: MarkdownTableLayout | null
}) => ({
  className: ["aq-table", isWideOverflowTable ? "aq-table-wide" : "aq-table-normal", className]
    .filter(Boolean)
    .join(" "),
  "data-fit-width": toOptionalTrueAttr(isFitWidthTable),
  "data-overflow-mode": isWideOverflowTable ? "wide" : undefined,
  "data-narrow-table": toOptionalTrueAttr(isNarrowTable),
  "data-header-row": layout?.headerRow === false ? "false" : undefined,
  "data-header-column": toOptionalTrueAttr(layout?.headerColumn === true),
})

export const MarkdownTableRenderer = ({
  children,
  className,
  layout,
}: {
  children?: ReactNode
  className?: string
  layout?: MarkdownTableLayout | null
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [tableUiMask, setTableUiMask] = useState(0)
  const { hasScrollLeft, showScrollHint, detectedColumnCount } = unpackTableUiState(tableUiMask)
  const isWideOverflowTable = layout?.overflowMode === "wide"
  const isFitWidthTable = layout?.fitWidth === true
  const columnWidths = layout?.columnWidths
  const renderedColumnCount = useMemo(() => countRenderedTableColumns(children), [children])
  const layoutColumnCount = Math.max(
    layout?.columnWidths?.length ?? 0,
    layout?.columnAlignments?.length ?? 0,
    layout?.cells?.[0]?.length ?? 0
  )
  const columnCount = Math.max(renderedColumnCount, layoutColumnCount, detectedColumnCount)
  const isNarrowTable = columnCount > 0 && columnCount <= 3
  const { normalizedColumnWidths, explicitTableWidth, hasExplicitColumnWidths } = useMemo(
    () => computeNormalizedColumnWidths(columnWidths),
    [columnWidths]
  )
  const hasAllExplicitColumnWidths =
    columnCount > 0 &&
    normalizedColumnWidths.length >= columnCount &&
    normalizedColumnWidths
      .slice(0, columnCount)
      .every((width): width is number => typeof width === "number" && width > 0)
  const usesExplicitNormalWidth =
    !isWideOverflowTable &&
    !isFitWidthTable &&
    hasAllExplicitColumnWidths &&
    explicitTableWidth > 0
  const tableStyle = useMemo<CSSProperties | undefined>(
    () =>
      resolveTableInlineStyle({
        hasAllExplicitColumnWidths,
        explicitTableWidth,
        isFitWidthTable,
        isWideOverflowTable,
      }),
    [explicitTableWidth, hasAllExplicitColumnWidths, isFitWidthTable, isWideOverflowTable]
  )
  const colgroupSlotCount = Math.max(columnCount, normalizedColumnWidths.length)
  const contextValue = useMemo<MarkdownTableRenderContextValue>(
    () => ({
      headerColumn: Boolean(layout?.headerColumn),
      rowHeights: layout?.rowHeights || [],
      columnAlignments: layout?.columnAlignments || [],
      cellLayouts: layout?.cells || [],
    }),
    [layout?.cells, layout?.columnAlignments, layout?.headerColumn, layout?.rowHeights]
  )
  const indexedChildren = provideIndexedTableRows(children)

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return undefined
    return bindTableScrollMetricsObserver(scrollElement, setTableUiMask)
  }, [explicitTableWidth, isFitWidthTable, isWideOverflowTable, usesExplicitNormalWidth])

  const widthModeAttr = usesExplicitNormalWidth ? "explicit-normal" : undefined
  const tableAttrs = buildTableElementAttributes({
    className,
    isWideOverflowTable,
    isFitWidthTable,
    isNarrowTable,
    layout,
  })

  return (
    <MarkdownTableRenderContext.Provider value={contextValue}>
      <div
        className="aq-table-shell"
        data-fit-width={toOptionalTrueAttr(isFitWidthTable)}
        data-table-width-mode={widthModeAttr}
        data-scroll-left={String(hasScrollLeft)}
        data-scroll-hint={String(showScrollHint)}
      >
        <div ref={scrollRef} className="aq-table-scroll" data-table-width-mode={widthModeAttr}>
          <table {...tableAttrs} style={tableStyle}>
            {hasExplicitColumnWidths ? (
              <colgroup>
                {Array.from({ length: colgroupSlotCount }, (_, index) => (
                  <col
                    key={`table-col-${index}`}
                    style={resolveTableColInlineStyle(
                      normalizedColumnWidths[index] ?? null,
                      isFitWidthTable,
                      hasAllExplicitColumnWidths,
                      explicitTableWidth
                    )}
                  />
                ))}
              </colgroup>
            ) : null}
            {indexedChildren}
          </table>
        </div>
      </div>
    </MarkdownTableRenderContext.Provider>
  )
}

export const MarkdownTableRowRenderer = ({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) => {
  const context = useContext(MarkdownTableRenderContext)
  const rowIndex = useContext(MarkdownTableRowIndexContext)
  const rowHeight = context?.rowHeights[rowIndex] || null
  const clampedHeight = rowHeight ? Math.max(TABLE_MIN_ROW_HEIGHT_PX, rowHeight) : undefined
  const rowStyle = clampedHeight ? ({ height: `${clampedHeight}px` } satisfies CSSProperties) : undefined

  let nextColumnIndex = 0
  const indexedCells = Children.map(children, (cellChild) => {
    if (!isValidElement(cellChild)) return cellChild
    const position: MarkdownTableCellPosition = { rowIndex, columnIndex: nextColumnIndex }
    nextColumnIndex += 1
    return createElement(MarkdownTableCellPositionContext.Provider, { value: position }, cellChild)
  })

  return (
    <tr className={className} data-row-height={clampedHeight} style={rowStyle}>
      {indexedCells}
    </tr>
  )
}

const toMarkdownAlignment = (alignment?: string): MarkdownTableCellAlignment | null =>
  alignment === "left" || alignment === "center" || alignment === "right" ? alignment : null

const toSpanAttr = (span?: number | null): number | undefined =>
  span && span > 1 ? span : undefined

const buildCellStyle = (
  textAlign?: MarkdownTableCellAlignment,
  backgroundColor?: string
): CSSProperties | undefined => {
  if (!textAlign && !backgroundColor) return undefined
  const style: CSSProperties = {}
  if (textAlign) style.textAlign = textAlign
  if (backgroundColor) style.backgroundColor = backgroundColor
  return style
}

export const MarkdownTableCellRenderer = ({
  alignment,
  as: Component,
  children,
  className,
}: {
  alignment?: string
  as: "td" | "th"
  children?: ReactNode
  className?: string
}) => {
  const tableContext = useContext(MarkdownTableRenderContext)
  const position = useContext(MarkdownTableCellPositionContext)
  const rowIndex = position?.rowIndex ?? 0
  const columnIndex = position?.columnIndex ?? 0
  const cellLayout = tableContext?.cellLayouts[rowIndex]?.[columnIndex] || null
  if (cellLayout?.hidden) return null

  const columnAlignment = tableContext?.columnAlignments[columnIndex] || null
  const textAlign = cellLayout?.align || columnAlignment || toMarkdownAlignment(alignment) || undefined
  const style = buildCellStyle(textAlign, cellLayout?.backgroundColor || undefined)
  const isHeaderColCell = Component === "td" && columnIndex === 0 && Boolean(tableContext?.headerColumn)

  return (
    <Component
      className={className}
      data-header-col-cell={toOptionalTrueAttr(isHeaderColCell)}
      rowSpan={toSpanAttr(cellLayout?.rowspan)}
      colSpan={toSpanAttr(cellLayout?.colspan)}
      style={style}
    >
      {children}
    </Component>
  )
}
