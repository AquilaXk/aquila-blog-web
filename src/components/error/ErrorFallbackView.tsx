import Link from "next/link"
import styled from "@emotion/styled"
import { ErrorState } from "src/design-system/StatePresenters"
import { ThemeProvider } from "src/layouts/RootLayout/ThemeProvider"
import { useLanguage } from "src/libs/language"

type ErrorFallbackVariant = "global" | "surface"

type ErrorFallbackViewProps = {
  variant: ErrorFallbackVariant
  requestId?: string | null
  onRetry?: () => void
}

const copyByVariant = {
  global: {
    status: "ERROR · 500",
    title: "문제가 발생했습니다",
    description:
      "예상하지 못한 오류로 화면을 표시하지 못했습니다. 다시 시도하거나 홈으로 이동하세요.",
  },
  surface: {
    status: "RENDER ERROR",
    title: "콘텐츠를 표시하지 못했습니다",
    description:
      "이 영역을 표시하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
  },
}

const FallbackShell = styled.div`
  & span:last-of-type {
    white-space: pre-line;
  }
`

export const ErrorFallbackView = ({
  variant,
  requestId = null,
  onRetry,
}: ErrorFallbackViewProps) => {
  const { t, language } = useLanguage()
  const copy = copyByVariant[variant]
  const isEnglish = language === "en"
  const title = isEnglish
    ? variant === "global"
      ? t("error500Title")
      : "Could not render this content"
    : copy.title
  const description = isEnglish
    ? variant === "global"
      ? t("error500Desc")
      : "An error occurred while displaying this section. Please try again."
    : copy.description
  const meta = requestId ? (isEnglish ? `Request ID: ${requestId}` : `요청 ID: ${requestId}`) : undefined
  const retryLabel = isEnglish ? "Retry" : "다시 시도"
  const homeLabel = isEnglish ? t("error500Home") : "홈으로 이동"

  const fallback = (
    <FallbackShell>
      <ErrorState
        data-error-boundary={variant}
        label={copy.status}
        title={title}
        description={description}
        meta={meta}
        actions={
          <>
            {onRetry ? (
              <button type="button" onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
            <Link href="/" data-tone="primary">
              {homeLabel}
            </Link>
          </>
        }
      />
    </FallbackShell>
  )

  return variant === "global" ? (
    <ThemeProvider scheme="light" blogDesign="legacy">
      {fallback}
    </ThemeProvider>
  ) : fallback
}
