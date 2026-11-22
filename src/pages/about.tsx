/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/social-icons/icons.tsx, MIT License, Copyright (c) 2023 Timothy Lin)
 * - lucide-icons/lucide (icons/{code,globe,mail}.svg, ISC License, Copyright (c) Lucide Contributors)
 * - simple-icons/simple-icons (icons/github.svg, CC0 1.0 Universal)
 */
import { GetServerSideProps } from "next"
import { CONFIG } from "site.config"
import MetaConfig from "src/components/MetaConfig"
import ProfileImage from "src/components/ProfileImage"
import { AdminProfile, useAdminProfile } from "src/hooks/useAdminProfile"
import { NextPageWithLayout } from "../types"
import { AboutPageView } from "src/routes/About/AboutPageView"
import {
  isExternalHref,
  isTimelineSection,
  normalizeSectionTitle,
  parseTimelineItem,
  type AboutProjectItem,
} from "src/routes/About/AboutPageModel"
import { ErrorState } from "src/design-system/StatePresenters"
import { fetchServerAdminProfile, resolvePublicAdminProfileCacheControl } from "src/libs/server/adminProfile"
import { shouldRefetchAdminProfileSource, type PublicAdminProfileSource } from "src/libs/adminProfileSource"
import { hasServerAuthCookie } from "src/libs/server/authSession"
import { appendSsrDebugTiming, isSsrDebugEnabled, timed } from "src/libs/server/serverTiming"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import { resolveRenderableProfileLinkHref } from "src/libs/utils/profileCardLinks"
import { parseLanguagePreference, useLanguage, type SiteLanguage } from "src/libs/language"

export const getServerSideProps: GetServerSideProps = withSsrMetrics("public", async ({ req, res }) => {
  const ssrStartedAt = performance.now()
  const hasAuthCookie = hasServerAuthCookie(req)
  const debugSsr = isSsrDebugEnabled(req)
  const adminProfileResult = await timed(() =>
    fetchServerAdminProfile(req, {
      timeoutMs: 1_800,
    })
  )
  const initialAdminProfile =
    adminProfileResult.ok && adminProfileResult.value
      ? adminProfileResult.value
      : null
  const initialAdminProfileSource: PublicAdminProfileSource =
    adminProfileResult.ok && adminProfileResult.value
      ? "published"
      : "unavailable"

  res.setHeader(
    "Cache-Control",
    resolvePublicAdminProfileCacheControl({
      debugSsr,
      hasAuthCookie,
      source: initialAdminProfileSource,
    })
  )
  appendSsrDebugTiming(req, res, [
    {
      name: "about-admin-profile",
      durationMs: adminProfileResult.durationMs,
      description: adminProfileResult.ok && adminProfileResult.value ? "ok" : "unavailable",
    },
    {
      name: "about-ssr-total",
      durationMs: performance.now() - ssrStartedAt,
      description: hasAuthCookie ? "member" : "public",
    },
  ])

  const initialLanguage = parseLanguagePreference(req.headers.cookie) ?? undefined

  return {
    props: {
      initialAdminProfile,
      initialAdminProfileSource,
      ...(initialLanguage ? { initialLanguage } : {}),
    },
  }
})

type AboutPageProps = {
  initialAdminProfile: AdminProfile | null
  initialAdminProfileSource: PublicAdminProfileSource
  initialLanguage?: SiteLanguage
}

const AboutPage: NextPageWithLayout<AboutPageProps> = ({ initialAdminProfile, initialAdminProfileSource }) => {
  const { language, t } = useLanguage()
  const isEn = language === "en"
  const shouldRefreshProfile = shouldRefetchAdminProfileSource(initialAdminProfileSource)
  const adminProfile = useAdminProfile(initialAdminProfile, {
    refetchOnMount: shouldRefreshProfile,
    staleTimeMs: shouldRefreshProfile ? 0 : undefined,
  })

  if (!adminProfile) {
    return (
      <ErrorState
        label="UNAVAILABLE"
        title={t("aboutUnavailableTitle")}
        description={t("aboutUnavailableDesc")}
        actions={
          <button type="button" onClick={() => window.location.reload()}>
            {t("aboutRetry")}
          </button>
        }
      />
    )
  }

  const displayName = adminProfile.nickname || adminProfile.name
  const displayHeadline =
    adminProfile.aboutHeadline?.trim() ||
    "이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다."
  const displayRole = adminProfile.aboutRole || ""
  const displayBio = adminProfile.aboutBio || ""
  const profileImageSrc = adminProfile.profileImageUrl
  const seenSectionTitles = new Set<string>()
  const aboutDetailSections = (adminProfile.aboutSections || [])
    .filter((section) => {
      const normalized = normalizeSectionTitle(section?.title ?? "")
      if (!normalized || seenSectionTitles.has(normalized)) return false
      seenSectionTitles.add(normalized)
      return true
    })
    .map((section) => ({
      title: section.title,
      items: section.items || [],
      hasDivider: section.dividerBefore,
    }))
  const blogTitle = adminProfile.blogTitle || CONFIG.blog.title
  const contactLinks = (adminProfile.contactLinks || [])
    .map((item) => {
      const safeHref = resolveRenderableProfileLinkHref("contact", item.href)
      return safeHref && isExternalHref(safeHref) ? { ...item, safeHref } : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const serviceLinks = (adminProfile.serviceLinks || [])
    .map((item) => {
      const safeHref = resolveRenderableProfileLinkHref("service", item.href)
      return safeHref && (safeHref.startsWith("https://") || safeHref.startsWith("http://"))
        ? { ...item, safeHref }
        : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const timelineSection = aboutDetailSections.find((section) => isTimelineSection(section.title))
  const supplementalSections = aboutDetailSections.filter((section) => section !== timelineSection)
  const hasProfileLinks = contactLinks.length > 0 || serviceLinks.length > 0
  const projectSectionTitle = adminProfile.aboutProjectSectionTitle?.trim() || "Projects"
  const projectItems: AboutProjectItem[] = (adminProfile.aboutProjects || []).map((project) => {
    const safeHref = resolveRenderableProfileLinkHref("service", project.href) || ""
    return {
      name: project.name,
      summary: project.summary,
      role: project.role,
      safeHref,
      linkLabel: project.linkLabel || "",
    }
  })
  const timelineItems = (timelineSection?.items || []).map(parseTimelineItem)
  const meta = {
    title: `About - ${blogTitle}`,
    description: displayBio,
    type: "website",
    url: `${CONFIG.link}/about`,
  }

  const renderSocialGlyph = (label: string, href: string) => {
    const lower = `${label} ${href}`.toLowerCase()
    if (lower.includes("mailto:") || lower.includes("mail") || lower.includes("email")) {
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      )
    }
    if (/^https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/?#]+/i.test(href)) {
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    }
    if (lower.includes("github")) {
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    )
  }

  const seenSocialHrefs = new Set<string>()
  const allSocialLinks = [...contactLinks, ...serviceLinks].filter((item) => {
    const key = item.safeHref.trim().replace(/\/+$/, "").toLowerCase()
    if (!key || seenSocialHrefs.has(key)) return false
    seenSocialHrefs.add(key)
    return true
  })

  return (
    <>
      <MetaConfig {...meta} />
      <AboutPageView>
        <div className="authorHeader">
          <h1>{t("navAbout")}</h1>
        </div>

        <div className="authorGrid">
          <div className="authorProfileCol">
            <div className="authorAvatar" data-ui="about-avatar">
              <ProfileImage
                src={profileImageSrc}
                width={192}
                height={192}
                alt={`${displayName} profile`}
                priority
                fillContainer
              />
            </div>
            <h2 className="authorName">{displayName}</h2>
            {displayRole ? <div className="authorRole">{displayRole}</div> : null}
            <div className="authorCompany">{blogTitle}</div>
            {hasProfileLinks ? (
              <div className="authorSocialRow" aria-label={t("aboutLinksHeading")}>
                {allSocialLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.safeHref}`}
                    href={item.safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    title={`${item.label} (${item.safeHref.replace(/^https?:\/\//, "")})`}
                    className="authorSocialLink"
                  >
                    {renderSocialGlyph(item.label, item.safeHref)}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="authorContentCol">
            <section className="authorProse">
              <h2>{displayHeadline}</h2>
              {displayBio ? <p>{displayBio}</p> : null}
            </section>

            {projectItems.length > 0 ? (
              <section className="sectionBlock" id="about-projects" data-ui="about-projects">
                <h2>{projectSectionTitle}</h2>
                <div className="projectCardGrid" data-ui="about-project-list">
                  {projectItems.map((item) => (
                    <article className="projectCard" key={item.name}>
                      <div className="projectCardBody">
                        {item.role ? <span className="projectCardRole">{item.role}</span> : null}
                        <h3>
                          {item.safeHref ? (
                            <a
                              href={item.safeHref}
                              target={isExternalHref(item.safeHref) ? "_blank" : undefined}
                              rel={isExternalHref(item.safeHref) ? "noopener noreferrer" : undefined}
                            >
                              {item.name}
                            </a>
                          ) : (
                            item.name
                          )}
                        </h3>
                        {item.summary ? <p>{item.summary}</p> : null}
                      </div>
                      {item.safeHref ? (
                        <a
                          href={item.safeHref}
                          target={isExternalHref(item.safeHref) ? "_blank" : undefined}
                          rel={isExternalHref(item.safeHref) ? "noopener noreferrer" : undefined}
                          className="projectCardMore"
                        >
                          {item.linkLabel || (isEn ? "Learn more" : "자세히 보기")} →
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {timelineItems.length > 0 ? (
              <section className="sectionBlock" data-ui="about-timeline-section">
                <h2>{timelineSection?.title}</h2>
                <ul className="proseList" data-ui="about-timeline">
                  {timelineItems.map((item) => (
                    <li className="proseListItem" key={`${item.label}-${item.date}`}>
                      {item.date ? <span className="proseListMeta">{item.date}</span> : null}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {supplementalSections.map((section, index) => (
              <section
                className="sectionBlock"
                key={`${section.title}-${index}`}
                data-has-divider={section.hasDivider ? "true" : "false"}
              >
                <h2>{section.title}</h2>
                <ul className="proseList">
                  {(section.items || []).map((item, itemIndex) => (
                    <li className="proseListItem" key={`${section.title}-${item}-${itemIndex}`}>
                      <span className="proseListMeta">{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </AboutPageView>
    </>
  )
}

export default AboutPage
