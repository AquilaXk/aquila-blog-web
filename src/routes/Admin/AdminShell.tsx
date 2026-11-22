/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/layout/app-sidebar/app-sidebar.tsx (MIT License, Copyright (c) Ghost Foundation)
 * - medusajs/medusa packages/admin/dashboard/src/components/layout/shell/shell.tsx (MIT License, Copyright (c) Medusa)
 * - shadcn-ui/ui blocks/dashboard-01/{app-sidebar.tsx,nav-main.tsx,site-header.tsx} & ui/dialog.tsx (MIT License, Copyright (c) shadcn)
 */
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/router"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import BrandLogoMark from "src/components/branding/BrandMark"
import ProfileImage from "src/components/ProfileImage"
import { ConfirmDialog } from "src/design-system/ConfirmDialog"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useAdminShellProfile } from "src/hooks/useAdminShellProfile"
import type { AuthMember } from "src/hooks/useAuthSession"
import { useLanguage } from "src/libs/language"
import {
  clearAllAdminEditorLocalDrafts,
  hasAdminEditorLocalDrafts,
} from "src/libs/privacy/browserStorageRegistry"
import { toAdminLoginPath } from "src/libs/router"
import type { AdminProfile } from "src/types/adminProfile"
import AppIcon from "./AdminAppIcon"
import { adminShellT } from "./adminShellI18n"
import {
  BrandBlock,
  BrandMark,
  ContentColumn,
  MobileDrawerScrim,
  NavLink,
  ShellFrame,
  Sidebar,
  SidebarAvatar,
  SidebarLogoutAction,
  SidebarNav,
  SidebarNavSection,
  SidebarProfile,
  SidebarProfileIdentity,
  StudioCardFrame,
} from "./AdminShellSidebar.styles"
import {
  Canvas,
  CompactNav,
  CompactNavLink,
  PaletteTriggerButton,
  PrimaryTopAction,
  ResponsiveLogoutAction,
  SecondaryTopAction,
  TopBar,
  TopBarActions,
  TopBarTitle,
} from "./AdminShellTopBar.styles"
import { SequenceHotkeyStateMachine } from "./AdminSequenceHotkey"
import {
  getNavItems,
  getSectionTitle,
  performAdminShellLogout,
  resolveProfileStatusLabel,
  type AdminShellSection,
} from "./AdminShellModel"

const loadCommandPalette = () =>
  import("./AdminCommandPalette").then((mod) => mod.AdminCommandPalette)

const AdminCommandPalette = dynamic(loadCommandPalette, { ssr: false })

export type { AdminShellSection } from "./AdminShellModel"
export { performAdminShellLogout } from "./AdminShellModel"

const SIDEBAR_COLLAPSED_STORAGE_KEY = "admin.shell.sidebarCollapsed.v1"

type AdminShellProps = {
  currentSection: AdminShellSection
  member: AuthMember
  profileSnapshot?: AdminProfile | null
  hasUnsavedChanges?: boolean
  unsavedLogoutMessage?: string
  children: ReactNode
}

const AdminShell = ({
  currentSection,
  member,
  profileSnapshot = null,
  hasUnsavedChanges = false,
  unsavedLogoutMessage,
  children,
}: AdminShellProps) => {
  const router = useRouter()
  const { language } = useLanguage()
  const isEn = language === "en"
  const navItems = getNavItems(language)
  const contentNavItems = navItems.filter(
    (item) => item.id === "hub" || item.id === "posts" || item.id === "cloud"
  )
  const systemNavItems = navItems.filter(
    (item) => item.id === "dashboard" || item.id === "tools" || item.id === "profile"
  )

  const sidebarIdentityName = (member.nickname || member.username || "관리자").trim()
  const sidebarIdentityInitial = sidebarIdentityName.slice(0, 2).toUpperCase()
  const {
    profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useAdminShellProfile(member.id, profileSnapshot)
  const sidebarProfileImageSrc = (profile?.profileImageUrl ?? "").trim()
  const [isProfileImageFailed, setIsProfileImageFailed] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [shortcutPrefix, setShortcutPrefix] = useState("⌘")
  const mobileDrawerRef = useRef<HTMLElement | null>(null)
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null)
  const closeMobileDrawer = useCallback(() => setIsMobileDrawerOpen(false), [])

  const { handleKeyDown: handleMobileDrawerKeyDown } = useModalFocusTrap({
    open: isMobileDrawerOpen,
    onClose: closeMobileDrawer,
    containerRef: mobileDrawerRef,
    returnFocusRef: mobileMenuToggleRef,
    paused: isPaletteOpen || isLogoutConfirmOpen,
    lockScroll: true,
  })

  const sequenceMachineRef = useRef<SequenceHotkeyStateMachine | null>(null)
  if (sequenceMachineRef.current === null) {
    sequenceMachineRef.current = new SequenceHotkeyStateMachine()
  }

  useEffect(() => {
    setIsProfileImageFailed(false)
  }, [sidebarProfileImageSrc])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!/mac|iphone|ipad|ipod/i.test(window.navigator?.platform || "")) {
      setShortcutPrefix("Ctrl ")
    }
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1") {
        setIsSidebarCollapsed(true)
      }
    } catch {}

    const idleTimer = window.setTimeout(() => {
      void loadCommandPalette()
    }, 600)
    return () => {
      window.clearTimeout(idleTimer)
    }
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        if (next) window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "1")
        else window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
      } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    setIsMobileDrawerOpen(false)
  }, [router.asPath])

  useEffect(() => {
    const machine = sequenceMachineRef.current
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        const lower = event.key.toLowerCase()
        if (lower === "k" && !event.isComposing && event.keyCode !== 229) {
          event.preventDefault()
          setIsPaletteOpen((prev) => !prev)
          return
        }
        if (lower === "b" && !event.isComposing && event.keyCode !== 229) {
          const target = event.target as HTMLElement | null
          const isEditor =
            target?.tagName === "INPUT" ||
            target?.tagName === "TEXTAREA" ||
            Boolean(target?.isContentEditable) ||
            Boolean(target?.closest(".cm-editor"))
          if (!isEditor) {
            event.preventDefault()
            toggleSidebarCollapsed()
            return
          }
        }
      }

      if (machine) {
        machine.handleKeyDown(
          event,
          (targetUrl) => void router.push(targetUrl),
          isPaletteOpen || isMobileDrawerOpen
        )
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      machine?.reset()
    }
  }, [isMobileDrawerOpen, isPaletteOpen, router, toggleSidebarCollapsed])

  const brandTitle = profile?.blogTitle?.trim() || "Aquila Studio"
  const currentTitle = getSectionTitle(currentSection, language)
  const profileStatusLabel = resolveProfileStatusLabel(
    isProfileError,
    isProfileLoading,
    profile,
    language
  )
  const effectiveCollapsed = isSidebarCollapsed && !isMobileDrawerOpen

  const executeConfirmedLogout = async () => {
    const proceeded = await performAdminShellLogout({
      hasUnsavedChanges,
      unsavedLogoutMessage,
      confirmFn: () => true,
      clearDrafts: () => clearAllAdminEditorLocalDrafts(),
      language,
    })
    if (!proceeded) return
    const rawNextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = toAdminLoginPath(rawNextPath, "/admin")
  }

  const hasLocalDrafts = isLogoutConfirmOpen ? hasAdminEditorLocalDrafts() : false
  const logoutConfirmDescription = hasUnsavedChanges
    ? unsavedLogoutMessage || adminShellT("shellLogoutConfirmUnsaved", language)
    : hasLocalDrafts
      ? adminShellT("shellLogoutConfirmDraft", language)
      : isEn
        ? "Your current admin session on this browser will end."
        : "현재 브라우저의 관리자 세션이 종료됩니다."

  return (
    <ShellFrame $collapsed={effectiveCollapsed} data-admin-frame="full">
      {isMobileDrawerOpen ? (
        <MobileDrawerScrim
          role="presentation"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      ) : null}

      <StudioCardFrame $collapsed={effectiveCollapsed}>
        <Sidebar
          ref={mobileDrawerRef}
          $collapsed={effectiveCollapsed}
          data-mobile-open={isMobileDrawerOpen ? "true" : undefined}
          role={isMobileDrawerOpen ? "dialog" : undefined}
          aria-modal={isMobileDrawerOpen ? true : undefined}
          aria-label={
            isMobileDrawerOpen ? (isEn ? "Admin menu" : "관리자 메뉴") : undefined
          }
          onKeyDown={isMobileDrawerOpen ? handleMobileDrawerKeyDown : undefined}
        >
          <div className="brandHeaderRow">
            <BrandBlock $collapsed={effectiveCollapsed}>
              <BrandMark>
                <BrandLogoMark className="brandLogoMark" priority />
              </BrandMark>
              <div className="brandCopy">
                <strong>{brandTitle}</strong>
                <small>{isEn ? "Admin Workspace" : "관리자 스튜디오"}</small>
              </div>
            </BrandBlock>
            {isMobileDrawerOpen ? (
              <button
                type="button"
                className="railToggleBtn"
                aria-label={isEn ? "Close menu" : "메뉴 닫기"}
                onClick={() => setIsMobileDrawerOpen(false)}
              >
                <AppIcon name="close" width={16} height={16} />
              </button>
            ) : null}
          </div>

          <SidebarNavSection>
            <div className="navGroup">
              <span className="groupLabel">{isEn ? "Content" : "콘텐츠 · 미디어"}</span>
              <SidebarNav aria-label={isEn ? "Primary navigation" : "주요 메뉴"}>
                {contentNavItems.map((item) => (
                  <NavLink
                    as={Link}
                    key={item.id}
                    href={item.href}
                    $collapsed={effectiveCollapsed}
                    title={effectiveCollapsed ? item.label : undefined}
                    aria-label={effectiveCollapsed ? item.label : undefined}
                    data-active={item.id === currentSection ? "true" : "false"}
                    aria-current={item.id === currentSection ? "page" : undefined}
                  >
                    <span>
                      <AppIcon name={item.icon} />
                    </span>
                    <strong>{item.label}</strong>
                  </NavLink>
                ))}
              </SidebarNav>
            </div>

            <div className="navGroup">
              <span className="groupLabel">{isEn ? "Operations" : "운영 · 설정"}</span>
              <SidebarNav aria-label={isEn ? "Operations navigation" : "운영 및 설정 메뉴"}>
                {systemNavItems.map((item) => (
                  <NavLink
                    as={Link}
                    key={item.id}
                    href={item.href}
                    $collapsed={effectiveCollapsed}
                    title={effectiveCollapsed ? item.label : undefined}
                    aria-label={effectiveCollapsed ? item.label : undefined}
                    data-active={item.id === currentSection ? "true" : "false"}
                    aria-current={item.id === currentSection ? "page" : undefined}
                  >
                    <span>
                      <AppIcon name={item.icon} />
                    </span>
                    <strong>{item.label}</strong>
                  </NavLink>
                ))}
              </SidebarNav>
            </div>
          </SidebarNavSection>

          <SidebarProfile $collapsed={effectiveCollapsed}>
            <SidebarProfileIdentity>
              <SidebarAvatar>
                {sidebarProfileImageSrc && !isProfileImageFailed ? (
                  <ProfileImage
                    src={sidebarProfileImageSrc}
                    alt={`${sidebarIdentityName} 프로필 이미지`}
                    fillContainer
                    onError={() => setIsProfileImageFailed(true)}
                  />
                ) : (
                  <span>{sidebarIdentityInitial}</span>
                )}
              </SidebarAvatar>
              <div className="profileCopy">
                <strong>{sidebarIdentityName}</strong>
                <span title={profileStatusLabel}>{profileStatusLabel}</span>
              </div>
            </SidebarProfileIdentity>
            {!effectiveCollapsed ? (
              <SidebarLogoutAction
                type="button"
                aria-label={adminShellT("shellLogoutAria", language)}
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <AppIcon name="log-out" />
              </SidebarLogoutAction>
            ) : null}
          </SidebarProfile>
        </Sidebar>

        <ContentColumn>
          <TopBar>
            <div className="topBarCrumb">
              <button
                type="button"
                className="railExpandBtn"
                aria-label={
                  effectiveCollapsed
                    ? isEn
                      ? "Expand sidebar (⌘B)"
                      : "사이드바 펼치기 (⌘B)"
                    : isEn
                      ? "Collapse sidebar (⌘B)"
                      : "사이드바 접기 (⌘B)"
                }
                title={`${shortcutPrefix}B`}
                onClick={toggleSidebarCollapsed}
              >
                <AppIcon name="panel-left" width={15} height={15} />
              </button>
              <span className="headerDivider" aria-hidden="true" />
              <button
                ref={mobileMenuToggleRef}
                type="button"
                className="mobileMenuBtn"
                aria-label={isEn ? "Open navigation menu" : "메뉴 열기"}
                aria-expanded={isMobileDrawerOpen}
                onClick={() => setIsMobileDrawerOpen(true)}
              >
                <AppIcon name="list" />
              </button>
              <TopBarTitle>
                <span className="shellHeaderTitle" data-ui="admin-shell-title">
                  {currentTitle}
                </span>
              </TopBarTitle>
            </div>

            <CompactNav aria-label={adminShellT("shellQuickNavAria", language)}>
              {navItems.map((item) => (
                <CompactNavLink
                  as={Link}
                  key={`compact-${item.id}`}
                  href={item.href}
                  data-active={item.id === currentSection ? "true" : "false"}
                  aria-label={item.label}
                  aria-current={item.id === currentSection ? "page" : undefined}
                >
                  <AppIcon name={item.icon} />
                  <span>{item.shortLabel}</span>
                </CompactNavLink>
              ))}
            </CompactNav>

            <TopBarActions>
              <PaletteTriggerButton
                type="button"
                aria-label={isEn ? "Command Palette (⌘K)" : "빠른 명령 (⌘K)"}
                onMouseEnter={() => void loadCommandPalette()}
                onClick={() => setIsPaletteOpen(true)}
              >
                <AppIcon name="search" width={13} height={13} />
                <span className="paletteLabel">{isEn ? "Commands" : "명령 팔레트"}</span>
                <kbd>{`${shortcutPrefix}K`}</kbd>
              </PaletteTriggerButton>
              <SecondaryTopAction as={Link} href="/">
                <AppIcon name="globe" width={13} height={13} />
                <span>{adminShellT("shellViewBlog", language)}</span>
              </SecondaryTopAction>
              <PrimaryTopAction as={Link} href="/admin/editor/new">
                {adminShellT("shellNewPost", language)}
              </PrimaryTopAction>
              <ResponsiveLogoutAction
                type="button"
                aria-label={adminShellT("shellLogoutAria", language)}
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <AppIcon name="log-out" />
              </ResponsiveLogoutAction>
            </TopBarActions>
          </TopBar>

          <Canvas id="admin-main-content">{children}</Canvas>
        </ContentColumn>
      </StudioCardFrame>

      <ConfirmDialog
        open={isLogoutConfirmOpen}
        titleId="admin-shell-logout-title"
        descriptionId="admin-shell-logout-desc"
        title={isEn ? "Sign out of Admin Studio?" : "관리자 스튜디오에서 로그아웃할까요?"}
        description={logoutConfirmDescription}
        confirmLabel={isEn ? "Sign out" : "로그아웃"}
        cancelLabel={isEn ? "Cancel" : "취소"}
        confirmTone="danger"
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false)
          void executeConfirmedLogout()
        }}
      />

      {isPaletteOpen ? (
        <AdminCommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
        />
      ) : null}
    </ShellFrame>
  )
}

export default AdminShell
