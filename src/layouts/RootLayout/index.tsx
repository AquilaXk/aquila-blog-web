/**
 * 참조 구현:
 * - withastro/starlight packages/starlight/components/SkipLink.astro (MIT License, Copyright (c) Astro contributors)
 * - fuma-nama/fumadocs packages/ui/src/components/layout/docs.tsx (MIT License, Copyright (c) Fuma Nama)
 */
import React, { ReactNode, useEffect } from "react"
import { ThemeProvider } from "./ThemeProvider"
import useScheme from "src/hooks/useScheme"
import Header from "./Header"
import styled from "@emotion/styled"
import { useRouter } from "next/router"
import { CONFIG } from "site.config"
import { useAdminProfile, type AdminProfile } from "src/hooks/useAdminProfile"
import { isNavigationCancelledError, isRequestCancelledError } from "src/libs/router"
import { isStandaloneSurfacePathname } from "src/libs/publicSurfaceUrl"
import { LanguageProvider, useLanguage, type SiteLanguage } from "src/libs/language"
import { zIndexes } from "src/styles/zIndexes"

const INITIAL_PROPS_CANCELLED_MESSAGE = "loading initial props cancelled"
export const RootAdminProfileContext = React.createContext<AdminProfile | null>(null)

export const useRootAdminProfile = () => React.useContext(RootAdminProfileContext)

type Props = {
  children: ReactNode
  initialAdminProfile?: AdminProfile | null
  initialAdminProfileShouldRefetch?: boolean
  initialLanguage?: SiteLanguage
}

export const resolveShouldRefetchAdminProfile = ({
  shouldLoadAdminProfile,
  isAdminRoute,
  initialAdminProfile,
  initialAdminProfileShouldRefetch,
}: {
  shouldLoadAdminProfile: boolean
  isAdminRoute: boolean
  initialAdminProfile: AdminProfile | null
  initialAdminProfileShouldRefetch: boolean
}): boolean =>
  shouldLoadAdminProfile &&
  (isAdminRoute ||
    initialAdminProfile == null ||
    initialAdminProfileShouldRefetch)

export const isPublicBlogRoutePath = (pathname: string): boolean =>
  pathname === "/" || pathname === "/feed" || pathname === "/about" || pathname === "/posts/[id]"

const RootLayout = ({
  children,
  initialAdminProfile = null,
  initialAdminProfileShouldRefetch = false,
  initialLanguage,
}: Props) => {
  // Enforce intentional light-only DOM/query scheme (PR 1275 / HIG P5-5).
  useScheme()
  const { pathname } = useRouter()
  const isDesignAwareRoute = pathname[1] !== "_" && pathname !== "/sitemap.xml"
  const isPublicBlogRoute = isPublicBlogRoutePath(pathname)
  const isDedicatedEditorRoute =
    pathname === "/admin/editor" || pathname.startsWith("/admin/editor/")
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  const isAdminLoginRoute = pathname === "/admin/login"
  const isStandaloneSurfaceRoute = isStandaloneSurfacePathname(pathname)
  const isFullBleedRoute = isDedicatedEditorRoute || isAdminRoute || isStandaloneSurfaceRoute
  const LayoutShell = isStandaloneSurfaceRoute ? StandaloneShell : StyledMain
  const shouldLoadAdminProfile =
    isDesignAwareRoute &&
    !isStandaloneSurfaceRoute &&
    !isAdminLoginRoute &&
    (isPublicBlogRoute ||
      isAdminRoute ||
      (initialAdminProfile != null && initialAdminProfileShouldRefetch))
  const shouldRefetchAdminProfile = resolveShouldRefetchAdminProfile({
    shouldLoadAdminProfile,
    isAdminRoute,
    initialAdminProfile,
    initialAdminProfileShouldRefetch,
  })
  const adminProfile = useAdminProfile(initialAdminProfile, {
    // 독립 표면은 관리자 프로필을 전혀 읽지 않는다. 여기서 켜 두면 blog 호스트 백엔드로 credentialed
    // XHR이 나가는데, 회사·제품 호스트에서는 그것이 cross-origin이고 edge에 그 origin을 허용하는
    // CORS가 없다 - 아무 화면 효과 없이 실패하는 요청만 남는다.
    enabled: shouldLoadAdminProfile,
    refetchOnMount: shouldRefetchAdminProfile,
    staleTimeMs: shouldRefetchAdminProfile ? 0 : undefined,
  })
  const effectiveScheme = "light"
  const effectiveBlogDesign = isAdminRoute ? adminProfile?.blogDesign || "legacy" : "legacy"
  const headerBlogTitle = (isPublicBlogRoute && adminProfile?.blogTitle?.trim()) || CONFIG.blog.title

  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV !== "production") return

    const isBenignRouteCancellationMessage = (value: unknown): boolean => {
      if (typeof value === "string") {
        return value.toLowerCase().includes(INITIAL_PROPS_CANCELLED_MESSAGE)
      }

      if (value instanceof Error) {
        return value.message.toLowerCase().includes(INITIAL_PROPS_CANCELLED_MESSAGE)
      }

      if (typeof value === "object" && value !== null && "message" in value) {
        const message = (value as { message?: unknown }).message
        if (typeof message === "string") {
          return message.toLowerCase().includes(INITIAL_PROPS_CANCELLED_MESSAGE)
        }
      }

      return false
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isNavigationCancelledError(event.reason) && !isRequestCancelledError(event.reason)) return
      event.preventDefault()
    }

    const handleWindowError = (event: ErrorEvent) => {
      const reason = event.error ?? event.message
      if (
        !isNavigationCancelledError(reason) &&
        !isRequestCancelledError(reason) &&
        !isBenignRouteCancellationMessage(reason)
      ) {
        return
      }
      event.preventDefault()
    }

    const originalConsoleError = window.console.error.bind(window.console)
    const filteredConsoleError: typeof window.console.error = (...args) => {
      if (
        args.some(
          (arg) =>
            isNavigationCancelledError(arg) ||
            isRequestCancelledError(arg) ||
            isBenignRouteCancellationMessage(arg)
        )
      ) {
        return
      }
      originalConsoleError(...args)
    }

    window.console.error = filteredConsoleError
    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleWindowError)
    return () => {
      window.console.error = originalConsoleError
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleWindowError)
    }
  }, [])

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      <ThemeProvider scheme={effectiveScheme} blogDesign={effectiveBlogDesign}>
        <RootAdminProfileContext.Provider value={adminProfile}>
          <SkipToMainNavigation />
          {isAdminRoute || isDedicatedEditorRoute || isStandaloneSurfaceRoute ? null : (
            <Header fullWidth={false} blogTitle={headerBlogTitle} />
          )}
          <LayoutShell id="main-content" tabIndex={-1} $fullBleed={isFullBleedRoute}>
            {children}
          </LayoutShell>
        </RootAdminProfileContext.Provider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default RootLayout

const SkipToMainNavigation = () => {
  const { t } = useLanguage()
  return <SkipToMainLink href="#main-content">{t("skipToMainContent")}</SkipToMainLink>
}

const SkipToMainLink = styled.a`
  position: fixed;
  top: -120px;
  left: 16px;
  z-index: ${zIndexes.confirmDialog + 10};
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 2px solid ${({ theme }) => theme.colors.indigo8};
  background: ${({ theme }) => theme.colors.gray12};
  color: ${({ theme }) => theme.publicDesign.readableSurface};
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;

  &:focus,
  &:focus-visible {
    top: 12px;
    clip: auto;
    clip-path: none;
    overflow: visible;
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
  }
`

const StyledMain = styled.main<{ $fullBleed?: boolean }>`
  margin: 0 auto;
  box-sizing: border-box;
  width: 100%;
  max-width: ${({ $fullBleed }) => ($fullBleed ? "none" : "64rem")};
  padding-left: ${({ $fullBleed }) => ($fullBleed ? "0" : "1rem")};
  padding-right: ${({ $fullBleed }) => ($fullBleed ? "0" : "1rem")};
  overflow-x: ${({ $fullBleed }) => ($fullBleed ? "clip" : "visible")};

  &:focus {
    outline: none;
  }

  ${({ $fullBleed }) =>
    $fullBleed
      ? ""
      : `
        @media (min-width: 640px) {
          padding-left: 1.5rem;
          padding-right: 1.5rem;
        }

        @media (min-width: 1280px) {
          padding-left: 0;
          padding-right: 0;
        }
      `}
`

/**
 * 같은 껍데기의 non-landmark 버전. 스타일을 복사하지 않고 `withComponent`로 태그만 바꾼다 - 복사하면
 * 한쪽 폭·overflow 규칙이 조용히 갈라진다.
 */
const StandaloneShell = StyledMain.withComponent("div")
