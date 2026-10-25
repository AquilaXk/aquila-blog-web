import {
  createContext,
  type CSSProperties,
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
  rowHeights: Array<number | null>
  columnAlignments: Array<MarkdownTableCellAlignment | null>
  cellLayouts: Array<Array<MarkdownTableCellLayout | null>>
  allocateRowIndex: () => number
}

type MarkdownTableRowContextValue = {
  rowIndex: number
  allocateCellIndex: () => number
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
const MarkdownTableRowContext = createContext<MarkdownTableRowContextValue | null>(null)

export const MarkdownTableRenderer = ({
  children,
  className,
  layout,
}: {
  children?: ReactNode
  className?: string
  layout?: MarkdownTableLayout | null
}) => {
  const rowCursorRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [tableUiMask, setTableUiMask] = useState(0)
  const { hasScrollLeft, showScrollHint, detectedColumnCount } = unpackTableUiState(tableUiMask)
  const isWideOverflowTable = layout?.overflowMode === "wide"
  const columnWidths = layout?.columnWidths
  const layoutColumnCount = Math.max(
    layout?.columnWidths?.length ?? 0,
    layout?.columnAlignments?.length ?? 0,
    layout?.cells?.[0]?.length ?? 0
  )
  const columnCount = layoutColumnCount > 0 ? layoutColumnCount : detectedColumnCount
  const isNarrowTable = columnCount > 0 && columnCount <= 3
  const { normalizedColumnWidths, explicitTableWidth, hasExplicitColumnWidths } = useMemo(() => {
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
    for (let i = 0; i < columnWidths.length; i += 1) {
      const width = columnWidths[i]
      if (typeof width === "number" && Number.isFinite(width) && width > 0) {
        const normalized = Math.max(TABLE_MIN_COLUMN_WIDTH_PX, Math.round(width))
        widths[i] = normalized
        totalWidth += normalized
        hasExplicit = true
      } else {
        widths[i] = null
      }
    }
    return {
      normalizedColumnWidths: widths,
      explicitTableWidth: totalWidth,
      hasExplicitColumnWidths: hasExplicit,
    }
  }, [columnWidths])
  const usesExplicitNormalWidth = !isWideOverflowTable && explicitTableWidth > 0
  const tableStyle = useMemo<CSSProperties | undefined>(() => {
    if ((isWideOverflowTable || usesExplicitNormalWidth) && explicitTableWidth > 0) {
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
  }, [explicitTableWidth, isWideOverflowTable, usesExplicitNormalWidth])
  rowCursorRef.current = 0
  const contextValue = useMemo<MarkdownTableRenderContextValue>(
    () => ({
      rowHeights: layout?.rowHeights || [],
      columnAlignments: layout?.columnAlignments || [],
      cellLayouts: layout?.cells || [],
      allocateRowIndex: () => {
        const currentIndex = rowCursorRef.current
        rowCursorRef.current += 1
        return currentIndex
      },
    }),
    [layout?.cells, layout?.columnAlignments, layout?.rowHeights]
  )

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
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
        const nextCols = domCols > 0 ? domCols : prevCols
        return packTableUiState(nextScrollLeft, nextScrollHint, nextCols)
      })
    }

    syncTableMetrics()
    scrollElement.addEventListener("scroll", syncScrollHint, { passive: true })
    window.addEventListener("resize", syncTableMetrics)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => syncTableMetrics())
      resizeObserver.observe(scrollElement)
      if (tableElement) resizeObserver.observe(tableElement)
    }

    return () => {
      scrollElement.removeEventListener("scroll", syncScrollHint)
      window.removeEventListener("resize", syncTableMetrics)
      resizeObserver?.disconnect()
    }
  }, [explicitTableWidth, isWideOverflowTable, usesExplicitNormalWidth])

  return (
    <MarkdownTableRenderContext.Provider value={contextValue}>
      <div
        className="aq-table-shell"
        data-table-width-mode={usesExplicitNormalWidth ? "explicit-normal" : undefined}
        data-scroll-left={hasScrollLeft ? "true" : "false"}
        data-scroll-hint={showScrollHint ? "true" : "false"}
      >
        <div
          ref={scrollRef}
          className="aq-table-scroll"
          data-table-width-mode={usesExplicitNormalWidth ? "explicit-normal" : undefined}
        >
          <table
            className={[
              "aq-table",
              isWideOverflowTable ? "aq-table-wide" : "aq-table-normal",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            data-overflow-mode={isWideOverflowTable ? "wide" : undefined}
            data-narrow-table={isNarrowTable ? "true" : undefined}
            style={tableStyle}
          >
            {hasExplicitColumnWidths ? (
              <colgroup>
                {normalizedColumnWidths.map((width, index) => {
                  if (!width) return <col key={`table-col-${index}`} />
                  return (
                    <col
                      key={`table-col-${index}`}
                      style={
                        isWideOverflowTable || usesExplicitNormalWidth
                          ? { width: `${width}px` }
                          : undefined
                      }
                    />
                  )
                })}
              </colgroup>
            ) : null}
            {children}
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
  const rowIndexRef = useRef<number | null>(null)

  if (context && rowIndexRef.current === null) {
    rowIndexRef.current = context.allocateRowIndex()
  }

  const rowHeight =
    rowIndexRef.current !== null ? context?.rowHeights[rowIndexRef.current] || null : null
  const rowStyle = rowHeight
    ? ({
        height: `${Math.max(TABLE_MIN_ROW_HEIGHT_PX, rowHeight)}px`,
      } satisfies CSSProperties)
    : undefined

  let cellCursor = 0
  const rowContextValue: MarkdownTableRowContextValue = {
    rowIndex: rowIndexRef.current ?? 0,
    allocateCellIndex: () => {
      const currentIndex = cellCursor
      cellCursor += 1
      return currentIndex
    },
  }

  return (
    <MarkdownTableRowContext.Provider value={rowContextValue}>
      <tr
        className={className}
        data-row-height={rowHeight ? Math.max(TABLE_MIN_ROW_HEIGHT_PX, rowHeight) : undefined}
        style={rowStyle}
      >
        {children}
      </tr>
    </MarkdownTableRowContext.Provider>
  )
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
  const rowContext = useContext(MarkdownTableRowContext)
  const cellIndexRef = useRef<number | null>(null)

  if (rowContext && cellIndexRef.current === null) {
    cellIndexRef.current = rowContext.allocateCellIndex()
  }

  const rowIndex = rowContext?.rowIndex ?? 0
  const columnIndex = cellIndexRef.current ?? 0
  const cellLayout = tableContext?.cellLayouts[rowIndex]?.[columnIndex] || null
  const columnAlignment = tableContext?.columnAlignments[columnIndex] || null
  const markdownAlignment: MarkdownTableCellAlignment | null =
    alignment === "left" || alignment === "center" || alignment === "right" ? alignment : null

  if (cellLayout?.hidden) {
    return null
  }

  const rowSpan = cellLayout?.rowspan && cellLayout.rowspan > 1 ? cellLayout.rowspan : undefined
  const colSpan = cellLayout?.colspan && cellLayout.colspan > 1 ? cellLayout.colspan : undefined
  const textAlign = cellLayout?.align || columnAlignment || markdownAlignment || undefined
  const backgroundColor = cellLayout?.backgroundColor || undefined
  const style = textAlign || backgroundColor
    ? ({
        ...(textAlign ? { textAlign } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      } satisfies CSSProperties)
    : undefined

  return (
    <Component className={className} rowSpan={rowSpan} colSpan={colSpan} style={style}>
      {children}
    </Component>
  )
}
