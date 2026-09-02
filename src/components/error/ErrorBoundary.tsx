import type { ReactNode } from "react"
import React from "react"

import { ApiError } from "src/apis/backend/client"
import { ErrorFallbackView } from "./ErrorFallbackView"

type ClientErrorBoundaryKind = "global" | "surface"
type ClientErrorSurface = "app" | "markdown" | "editor"

type ErrorBoundaryProps = {
  children: ReactNode
  boundary: ClientErrorBoundaryKind
  surface: ClientErrorSurface
  resetKey?: string | number
}

type ErrorBoundaryState = {
  hasError: boolean
  requestId: string | null
}

const resolveCaughtRequestId = (error: unknown): string | null => {
  if (error instanceof ApiError) return error.requestId
  return null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    requestId: null,
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      requestId: resolveCaughtRequestId(error),
    }
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, requestId: null })
    }
  }

  private retry = () => {
    this.setState({ hasError: false, requestId: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackView
          variant={this.props.boundary === "global" ? "global" : "surface"}
          requestId={this.state.requestId}
          onRetry={this.retry}
        />
      )
    }

    return this.props.children
  }
}

type BoundaryWrapperProps = {
  children: ReactNode
  resetKey?: string | number
}

export const GlobalErrorBoundary = ({ children, resetKey }: BoundaryWrapperProps) => (
  <ErrorBoundary boundary="global" surface="app" resetKey={resetKey}>
    {children}
  </ErrorBoundary>
)

export const RecoverableSurfaceBoundary = ({
  children,
  resetKey,
  surface,
}: BoundaryWrapperProps & { surface: Exclude<ClientErrorSurface, "app"> }) => (
  <ErrorBoundary boundary="surface" surface={surface} resetKey={resetKey}>
    {children}
  </ErrorBoundary>
)
