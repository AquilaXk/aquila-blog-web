/**
 * 참조 구현:
 * - launch-ui/launch-ui (components/sections/{items,footer}/default.tsx, MIT License)
 * - mickasmt/next-saas-stripe-starter (components/layout/{site-header,site-footer}.tsx, MIT License)
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/{tabs,card,badge}.tsx, MIT License)
 * - fuma-nama/fumadocs (packages/base-ui/src/components/codeblock.tsx, MIT License)
 */
import { useEffect, useState } from "react"
import { CONFIG } from "site.config"
import BrandMark, { ArrowRightGlyph } from "src/components/branding/BrandMark"
import {
  EASYOFFICE_LATEST_RELEASE_URL,
  EASYOFFICE_OS_MAP,
  EASYOFFICE_OS_PLATFORMS,
  EASYOFFICE_RELEASES_URL,
  EASYOFFICE_REPO_URL,
  EASYOFFICE_STUDIO_MODULES,
  detectClientDownloadOs,
  resolveEasyOfficeAssetUrl,
  resolvePlatformChecksums,
  type DownloadOsKey,
  type EasyOfficeReleaseInfo,
} from "src/routes/Company/CompanyDownloadModel"
import {
  AppleOsGlyph,
  CheckGlyph,
  CompanyVectorIcon,
  CopyGlyph,
  DownloadGlyph,
  LinuxOsGlyph,
  SparklesGlyph,
  WindowsOsGlyph,
} from "src/routes/Company/CompanyIcons"
import {
  BLOG_URL,
  COMPANY_FOOTER_LINK_GROUPS,
  COMPANY_SURFACE,
  CONTACT_MAILTO,
  EASYCONVERT_URL,
} from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanyPage.styles"
import * as Sec from "src/routes/Company/CompanySection.styles"
import * as D from "src/routes/Company/CompanyDownload.styles"
import { useCompanySurfaceMotion } from "src/routes/Company/useCompanySurfaceMotion"

type Props = {
  initialOs: DownloadOsKey
  hasExplicitOsQuery: boolean
  surfaceUrl: string
  companyUrl: string
  release?: EasyOfficeReleaseInfo | null
}

const renderOsGlyph = (os: DownloadOsKey, size = 17) => {
  switch (os) {
    case "windows":
      return <WindowsOsGlyph size={size} />
    case "linux":
      return <LinuxOsGlyph size={size} />
    default:
      return <AppleOsGlyph size={size} />
  }
}

const CompanyDownloadPageView: React.FC<Props> = ({
  initialOs,
  hasExplicitOsQuery,
  surfaceUrl,
  companyUrl,
  release = null,
}) => {
  const surfaceRef = useCompanySurfaceMotion<HTMLDivElement>()
  const [activeOs, setActiveOs] = useState<DownloadOsKey>(initialOs)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (hasExplicitOsQuery || typeof navigator === "undefined") return
    const detected = detectClientDownloadOs(navigator.userAgent, navigator.platform || "")
    setActiveOs((current) => (current === detected ? current : detected))
  }, [hasExplicitOsQuery])

  const handleSelectOs = (nextOs: DownloadOsKey) => {
    setActiveOs(nextOs)
    if (typeof window === "undefined") return
    try {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set("os", nextOs)
      window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    } catch {
      // ignore malformed URL state
    }
  }

  const handleCopySnippet = async (id: string, command: string) => {
    try {
      await navigator.clipboard?.writeText(command)
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 2000)
    } catch {
      setCopiedId(null)
    }
  }

  const currentPlatform = EASYOFFICE_OS_MAP[activeOs]
  const platformChecksums = resolvePlatformChecksums(activeOs, release)
  const releaseSummaryHref =
    release && release.releaseUrl.startsWith(`${EASYOFFICE_RELEASES_URL}/tag/`)
      ? release.releaseUrl
      : EASYOFFICE_LATEST_RELEASE_URL
  const versionChipLabel = release ? `${release.tag} · ${release.publishedDate}` : "최신 정식 릴리스"

  return (
    <S.CompanySurface ref={surfaceRef} data-download-page data-active-os={activeOs}>
      <S.SurfaceHeader data-header data-scroll-reactive="true">
        <S.HeaderInner>
          <S.BrandLink href={companyUrl} style={{ minHeight: 44 }}>
            <BrandMark priority />
            <span>{COMPANY_SURFACE.name}</span>
          </S.BrandLink>
          <S.SurfaceNav aria-label="다운로드 둘러보기">
            <S.NavLink href={companyUrl}>회사 소개</S.NavLink>
            <S.NavLink href={`${companyUrl}#work`}>제품</S.NavLink>
            <S.NavLink href={surfaceUrl} aria-current="page">
              다운로드
            </S.NavLink>
            <S.NavLink href={BLOG_URL}>기술 블로그</S.NavLink>
          </S.SurfaceNav>
          <S.HeaderAction href={CONTACT_MAILTO}>
            <span>문의하기</span>
            <ArrowRightGlyph size={14} />
          </S.HeaderAction>
        </S.HeaderInner>
      </S.SurfaceHeader>

      <D.DownloadAnnouncementBar>
        <D.DownloadAnnouncementInner>
          <span className="annBadge">
            <SparklesGlyph size={11} />
            <span>{release ? "최신 릴리스" : "정식 배포"}</span>
          </span>
          <span>
            {release
              ? `EasyOffice ${release.tag} 정식 배포 (${release.publishedDate}) — macOS · Windows · Linux 설치 파일 및 서명 체크섬`
              : "EasyOffice 데스크탑 정식 릴리스 — macOS · Windows · Linux 설치 파일 및 서명 체크섬"}
          </span>
          <a href={releaseSummaryHref}>
            <span>{release ? "릴리스 노트 보기" : "최신 릴리스 보기"}</span>
            <ArrowRightGlyph size={13} />
          </a>
        </D.DownloadAnnouncementInner>
      </D.DownloadAnnouncementBar>

      <main>
        <D.DownloadHeaderBand>
          <D.DownloadHeaderRow>
            <h1>
              EasyOffice
              <span>다운로드</span>
            </h1>
            <D.SecondaryActionPill href={EASYOFFICE_RELEASES_URL}>
              이전 릴리스 보기
            </D.SecondaryActionPill>
          </D.DownloadHeaderRow>
        </D.DownloadHeaderBand>

        <D.StickyOsNav aria-label="운영체제 선택">
          <D.StickyOsNavInner role="tablist" aria-label="EasyOffice 지원 운영체제">
            {EASYOFFICE_OS_PLATFORMS.map((platform) => {
              const selected = platform.os === activeOs
              return (
                <D.OsTabButton
                  key={platform.os}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  data-os={platform.os}
                  $active={selected}
                  onClick={() => handleSelectOs(platform.os)}
                >
                  {renderOsGlyph(platform.os, 16)}
                  <span>{platform.label}</span>
                </D.OsTabButton>
              )
            })}
          </D.StickyOsNavInner>
        </D.StickyOsNav>

        <D.DownloadSectionBand id="desktop-app" aria-labelledby="easyoffice-desktop-heading">
          <D.DownloadSectionInner>
            <D.SectionHeaderRow>
              <h2 id="easyoffice-desktop-heading">EasyOffice Desktop</h2>
              <D.VersionChip href={releaseSummaryHref} data-ui="easyoffice-release-version">
                {versionChipLabel}
              </D.VersionChip>
            </D.SectionHeaderRow>
            <D.SectionDescription>
              문서·시트·슬라이드·PDF·한글(HWP/HWPX) 파일을 외부 서버 전송 없이 기기 안에서 여는 오프라인
              올인원 오피스입니다.
            </D.SectionDescription>
            <D.CtaRow>
              {currentPlatform.actions.map((action) => {
                const actionHref = resolveEasyOfficeAssetUrl(action.assetName, release)
                return action.variant === "primary" ? (
                  <D.PrimaryActionPill key={action.label} href={actionHref}>
                    <DownloadGlyph size={16} />
                    <span>{action.label}</span>
                  </D.PrimaryActionPill>
                ) : (
                  <D.SecondaryActionPill key={action.label} href={actionHref}>
                    {action.label}
                  </D.SecondaryActionPill>
                )
              })}
            </D.CtaRow>
            <D.RequirementBlock>
              <p className="reqLabel">최소 요구사항</p>
              <p className="reqBody">{currentPlatform.requirements}</p>
              <p className="reqNote">{currentPlatform.installNote}</p>
            </D.RequirementBlock>
          </D.DownloadSectionInner>
        </D.DownloadSectionBand>

        <D.DownloadSectionBand id="verify-install" aria-labelledby="easyoffice-verify-heading">
          <D.DownloadSectionInner>
            <D.SectionHeaderRow>
              <h2 id="easyoffice-verify-heading">설치 및 체크섬 검증</h2>
              <D.VersionChip href={EASYOFFICE_REPO_URL}>Rust · Tauri v2</D.VersionChip>
            </D.SectionHeaderRow>
            <D.SectionDescription>
              릴리스에 포함된 SHA-256 체크섬 파일과 대조하거나 터미널에서 패키지를 바로 설치할 수
              있습니다.
            </D.SectionDescription>
            <D.SnippetList>
              {currentPlatform.snippets.map((snippet) => {
                const isCopied = copiedId === snippet.id
                return (
                  <D.SnippetGroup key={snippet.id}>
                    <D.SnippetHeader>
                      {renderOsGlyph(snippet.os, 16)}
                      <span>{snippet.title}</span>
                    </D.SnippetHeader>
                    <D.SnippetBox>
                      <code>{snippet.command}</code>
                      <D.CopyButton
                        type="button"
                        aria-label={`${snippet.title} 명령어 복사`}
                        onClick={() => handleCopySnippet(snippet.id, snippet.command)}
                      >
                        {isCopied ? <CheckGlyph size={15} /> : <CopyGlyph size={15} />}
                        <span>{isCopied ? "복사됨" : "복사"}</span>
                      </D.CopyButton>
                    </D.SnippetBox>
                  </D.SnippetGroup>
                )
              })}
            </D.SnippetList>
            {release && platformChecksums.length > 0 && (
              <D.SnippetList data-ui="easyoffice-release-checksums">
                {platformChecksums.map((entry) => {
                  const checksumId = `checksum-${entry.assetName}`
                  const isCopied = copiedId === checksumId
                  return (
                    <D.SnippetGroup key={checksumId}>
                      <D.SnippetHeader>
                        <CompanyVectorIcon name="file-check-2" size={16} strokeWidth={1.85} />
                        <span>{entry.assetName} SHA-256</span>
                      </D.SnippetHeader>
                      <D.SnippetBox>
                        <code>{entry.sha256}</code>
                        <D.CopyButton
                          type="button"
                          aria-label={`${entry.assetName} SHA-256 해시 복사`}
                          onClick={() => handleCopySnippet(checksumId, entry.sha256)}
                        >
                          {isCopied ? <CheckGlyph size={15} /> : <CopyGlyph size={15} />}
                          <span>{isCopied ? "복사됨" : "복사"}</span>
                        </D.CopyButton>
                      </D.SnippetBox>
                    </D.SnippetGroup>
                  )
                })}
              </D.SnippetList>
            )}
          </D.DownloadSectionInner>
        </D.DownloadSectionBand>

        <D.DownloadSectionBand id="studio-modules" aria-labelledby="easyoffice-modules-heading">
          <D.DownloadSectionInner>
            <D.SectionHeaderRow>
              <h2 id="easyoffice-modules-heading">내장 스튜디오 모듈</h2>
              <D.VersionChip href={`${EASYOFFICE_REPO_URL}/blob/main/docs/product-spec.md`}>
                6개 통합 워크스페이스
              </D.VersionChip>
            </D.SectionHeaderRow>
            <D.SectionDescription>
              단일 앱 설치만으로 아래 모든 문서·데이터 편집기와 로컬 변환 도구를 바로 사용할 수 있습니다.
            </D.SectionDescription>
            <D.StudioModulesGrid>
              {EASYOFFICE_STUDIO_MODULES.map((mod) => (
                <D.StudioModuleCardWrap key={mod.id} data-spotlight="true">
                  <div className="moduleHead">
                    <span className="moduleIcon">
                      <CompanyVectorIcon name={mod.icon} size={22} strokeWidth={1.85} />
                    </span>
                    <h3>{mod.title}</h3>
                    <D.FormatChip>{mod.badge}</D.FormatChip>
                  </div>
                  <p>{mod.description}</p>
                  <D.SecondaryActionPill href={mod.actionHref}>
                    {mod.actionLabel}
                  </D.SecondaryActionPill>
                </D.StudioModuleCardWrap>
              ))}
            </D.StudioModulesGrid>
          </D.DownloadSectionInner>
        </D.DownloadSectionBand>

        <D.DownloadSectionBand id="web-convert-api" aria-labelledby="easyconvert-link-heading">
          <D.DownloadSectionInner>
            <D.SectionHeaderRow>
              <h2 id="easyconvert-link-heading">설치 없이 웹·API 파일 변환</h2>
              <D.VersionChip href={EASYCONVERT_URL}>308개 포맷</D.VersionChip>
            </D.SectionHeaderRow>
            <D.SectionDescription>
              로컬 데스크탑 앱 외에 영상·오디오·CAD·카메라 RAW 등 13개 분류 308개 포맷 변환이
              필요하다면 브라우저와 OpenAPI 3.1 REST API로 바로 실행할 수 있습니다.
            </D.SectionDescription>
            <D.CtaRow>
              <D.SecondaryActionPill href={EASYCONVERT_URL}>
                <span>EasyConvert 웹 서비스 열기</span>
                <ArrowRightGlyph size={15} />
              </D.SecondaryActionPill>
              <D.SecondaryActionPill href={`${EASYOFFICE_REPO_URL}/blob/main/docs/DEVELOPMENT.md`}>
                소스에서 직접 빌드하기
              </D.SecondaryActionPill>
            </D.CtaRow>
          </D.DownloadSectionInner>
        </D.DownloadSectionBand>
      </main>

      <S.SurfaceFooter>
        <S.FooterInner>
          <S.FooterBrand>
            <div>
              <BrandMark />
              <span>{COMPANY_SURFACE.name}</span>
            </div>
            <p>일상의 문턱을 낮추는 소프트웨어를 만듭니다.</p>
          </S.FooterBrand>
          {COMPANY_FOOTER_LINK_GROUPS.map((group) => (
            <S.FooterGroup as="nav" key={group.id} aria-label={group.title}>
              <h2>{group.title}</h2>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </S.FooterGroup>
          ))}
        </S.FooterInner>
        <Sec.FooterWordmarkBanner aria-hidden="true">
          <p className="footerWordmarkText">{COMPANY_SURFACE.name}</p>
        </Sec.FooterWordmarkBanner>
        <S.FooterBottomBar>
          <span>© {CONFIG.since} {COMPANY_SURFACE.name}</span>
          <span>EasySubway · EasyOffice · EasyConvert · AquilaLog</span>
        </S.FooterBottomBar>
      </S.SurfaceFooter>
    </S.CompanySurface>
  )
}

export default CompanyDownloadPageView
