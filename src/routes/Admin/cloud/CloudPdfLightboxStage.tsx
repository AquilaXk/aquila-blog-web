// 참조 구현: strapi/strapi & mozilla/pdf.js (MIT/Apache-2.0) — 라이트박스 PDF 캔버스 스테이지
import type { RenderTask } from "pdfjs-dist"
import { useEffect, useRef, useState } from "react"
import { getCloudFileDownloadUrl, type CloudFile } from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import {
  YarlBottomBar,
  YarlDarkPill,
  YarlFallbackDownloadLink,
  YarlMediaCard,
  YarlPageReadout,
  YarlPdfSheet,
} from "../AdminCloudMediaLightbox.styles"
import { YarlErrorIcon } from "../adminStrapiIcons"
import { renderCloudPdfPageToCanvas, useCloudPdfDocument } from "./cloudPreviewHelpers"

export const CloudPdfLightboxStage = ({
  file,
  contentUrl,
  pdfZoom,
  currentPage,
  onChangePage,
}: {
  file: CloudFile
  contentUrl: string
  pdfZoom: number
  currentPage: number
  onChangePage: (next: number) => void
}) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pdfDoc, pageCount, loadError, renderTaskRef } = useCloudPdfDocument(file, contentUrl, true)
  const [renderFailed, setRenderFailed] = useState(false)

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false
    let activeTask: RenderTask | null = null
    setRenderFailed(false)
    void renderCloudPdfPageToCanvas(
      pdfDoc,
      currentPage,
      1.5 * pdfZoom,
      canvasRef.current,
      renderTaskRef,
      () => cancelled
    )
      .then((t) => {
        activeTask = t
      })
      .catch(() => {
        if (!cancelled) setRenderFailed(true)
      })
    return () => {
      cancelled = true
      activeTask?.cancel()
      if (renderTaskRef.current === activeTask) renderTaskRef.current = null
    }
  }, [currentPage, pdfDoc, pdfZoom, renderTaskRef])

  if (loadError || renderFailed) {
    return (
      <YarlMediaCard role="alert" onClick={(e) => e.stopPropagation()}>
        <YarlErrorIcon width={40} height={40} />
        <strong>{isEn ? "Unable to render PDF document" : "PDF 문서를 렌더링하지 못했습니다"}</strong>
        <span>{file.originalFilename}</span>
        <YarlFallbackDownloadLink href={getCloudFileDownloadUrl(file.id)} download={file.originalFilename}>
          {isEn ? "Download original" : "원본 파일 다운로드"}
        </YarlFallbackDownloadLink>
      </YarlMediaCard>
    )
  }

  return (
    <YarlPdfSheet $widthRem={57.5 * pdfZoom} onClick={(e) => e.stopPropagation()}>
      <canvas
        ref={canvasRef}
        aria-label={isEn ? `${file.originalFilename} PDF preview` : `${file.originalFilename} PDF 문서 미리보기`}
      />
      <YarlBottomBar role="group" aria-label={isEn ? "PDF page navigation" : "PDF 페이지 이동"}>
        <YarlDarkPill
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onChangePage(Math.max(1, currentPage - 1))}
        >
          {isEn ? "Prev page" : "이전 페이지"}
        </YarlDarkPill>
        <YarlPageReadout>
          {isEn ? `${currentPage} / ${pageCount || 1}` : `${currentPage} / ${pageCount || 1}쪽`}
        </YarlPageReadout>
        <YarlDarkPill
          type="button"
          disabled={pageCount <= 1 || currentPage >= pageCount}
          onClick={() => onChangePage(Math.min(pageCount || 1, currentPage + 1))}
        >
          {isEn ? "Next page" : "다음 페이지"}
        </YarlDarkPill>
      </YarlBottomBar>
    </YarlPdfSheet>
  )
}
