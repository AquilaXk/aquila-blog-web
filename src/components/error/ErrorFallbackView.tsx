import Link from "next/link"
import styled from "@emotion/styled"
import { ErrorState } from "src/design-system/StatePresenters"
import { ThemeProvider } from "src/layouts/RootLayout/ThemeProvider"

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
      "이 영역을 렌더링하는 중 오류가 발생했습니다. 작성 중인 내용은 브라우저에 남아 있으며 다시 시도할 수 있습니다.",
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
  const copy = copyByVariant[variant]
  const meta = requestId ? `요청 ID: ${requestId}` : undefined

  const fallback = (
    <FallbackShell>
      <ErrorState
        data-error-boundary={variant}
        label={copy.status}
        title={copy.title}
        description={copy.description}
        meta={meta}
        actions={
          <>
            {onRetry ? (
              <button type="button" onClick={onRetry}>
                다시 시도
              </button>
            ) : null}
            <Link href="/" data-tone="primary">
              홈으로 이동
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
