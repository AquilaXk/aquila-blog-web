// 참조 구현: payloadcms/payload (MIT) & squidfunk/mkdocs-material (MIT) — 슬라이딩 페이지네이션 점프 모델
export type PaginationPageItem = number | "ellipsis"

export const generatePaginationPages = (
  currentPage: number,
  totalPages: number,
  maxVisible = 7
): PaginationPageItem[] => {
  if (totalPages <= 1) return [1]
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: PaginationPageItem[] = [1]
  const current = Math.max(1, Math.min(currentPage, totalPages))

  // 좌우 반경
  const sideWidth = 1 // 현재 페이지 양 옆으로 보여줄 개수
  const leftBound = Math.max(2, current - sideWidth)
  const rightBound = Math.min(totalPages - 1, current + sideWidth)

  if (leftBound > 2) {
    pages.push("ellipsis")
  }

  for (let i = leftBound; i <= rightBound; i += 1) {
    pages.push(i)
  }

  if (rightBound < totalPages - 1) {
    pages.push("ellipsis")
  }

  pages.push(totalPages)
  return pages
}
