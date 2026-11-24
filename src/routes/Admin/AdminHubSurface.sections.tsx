/**
 * 참조 구현:
 * - TryGhost/Ghost apps/shade/src/components/{ui/kpi-card.tsx,ui/data-list.tsx,layout/list-page.tsx} (MIT License, Copyright (c) Ghost Foundation)
 * - medusajs/medusa packages/design-system/ui/src/components/status-badge (MIT License, Copyright (c) Medusa)
 * - tremorlabs/tremor packages/tremor-react/src/components/vis-elements/BarList/BarList.tsx (Apache-2.0 License, Copyright (c) Tremor Labs)
 */
import Link from "next/link"
import { useState } from "react"
import { useLanguage } from "src/libs/language"
import AppIcon from "./AdminAppIcon"
import type {
  AdminHubContentItem,
  AdminHubMetricItem,
  AdminHubPrimaryAction,
  AdminHubRecentWorkItem,
  AdminHubStatusItem,
} from "./AdminHubSurface"
import {
  ActivityList,
  AnalyticsBand,
  AnalyticsSideStack,
  ContentList,
  ContentRow,
  ContentTableHead,
  EmptyPanel,
  HeroActions,
  HeroCopy,
  HeroHeader,
  HeroHeading,
  HubRefreshButton,
  HubRefreshNotice,
  Main,
  MetricCard,
  MetricGrid,
  Panel,
  PanelHeader,
  PanelHeaderLink,
  PrimaryActionLink,
  SecondaryActionLink,
  SegmentedToggle,
  ShareBarCopy,
  ShareBarFill,
  ShareBarItem,
  ShareBarList,
  ShareBarValue,
  StatusList,
  StatusRow,
  SubSectionTitle,
} from "./AdminHubSurface.styles"
import {
  deriveAdminHubShareBars,
  formatAdminHubContentStatus,
  formatAdminHubMetricLabel,
} from "./AdminHubSurfaceModel"

type AdminHubSurfaceSectionsProps = {
  displayName: string
  greeting: string
  recentWorkSummary: string
  primaryAction: AdminHubPrimaryAction
  metrics: AdminHubMetricItem[]
  contentItems: AdminHubContentItem[]
  serviceStatusItems: AdminHubStatusItem[]
  activityItems: AdminHubRecentWorkItem[]
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshError?: string | null
}

export const AdminHubSurfaceSections = ({
  displayName,
  greeting,
  recentWorkSummary,
  primaryAction,
  metrics,
  contentItems,
  serviceStatusItems,
  activityItems,
  onRefresh,
  isRefreshing = false,
  refreshError = null,
}: AdminHubSurfaceSectionsProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [tableTab, setTableTab] = useState<"all" | "published" | "draft">("all")

  const shareBars = deriveAdminHubShareBars(contentItems)
  const healthyChecks = serviceStatusItems.filter((item) => item.tone === "good").length
  const publishedItems = contentItems.filter((item) => item.tone === "good")
  const draftItems = contentItems.filter((item) => item.tone !== "good")
  const visibleContentItems =
    tableTab === "published" ? publishedItems : tableTab === "draft" ? draftItems : contentItems

  return (
    <Main>
      <HeroHeader>
        <HeroCopy>
          <HeroHeading>
            {greeting}, {displayName}.
          </HeroHeading>
          <p>{recentWorkSummary}</p>
        </HeroCopy>
        <HeroActions>
          {onRefresh ? (
            <HubRefreshButton
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              aria-label={isEn ? "Refresh dashboard status" : "허브 상태 새로고침"}
            >
              <AppIcon name="refresh" width={14} height={14} />
              <span>
                {isRefreshing
                  ? isEn
                    ? "Refreshing..."
                    : "새로고침 중..."
                  : isEn
                    ? "Refresh"
                    : "새로고침"}
              </span>
            </HubRefreshButton>
          ) : null}
          <SecondaryActionLink as={Link} href={primaryAction.secondaryHref}>
            <span>{isEn ? "View All Posts" : "글 전체 보기"}</span>
            <AppIcon name="arrow-right" width={14} height={14} />
          </SecondaryActionLink>
        </HeroActions>
      </HeroHeader>

      {refreshError ? (
        <HubRefreshNotice role="status" data-tone="warn">
          {refreshError}
        </HubRefreshNotice>
      ) : null}

      <MetricGrid aria-label={isEn ? "Admin Core Metrics" : "관리자 핵심 지표"}>
        {metrics.map((item) => (
          <MetricCard key={item.label} data-slot="card" data-tone={item.tone || "neutral"}>
            <span className="cardDescription">{formatAdminHubMetricLabel(item.label, isEn)}</span>
            <strong>{item.value}</strong>
            {item.detail ? <div className="cardFooter">{item.detail}</div> : null}
          </MetricCard>
        ))}
      </MetricGrid>

      <AnalyticsBand>
        <Panel>
          <PanelHeader>
            <div className="titleBlock">
              <div className="titleInline">
                <h2>{isEn ? "Recent Content" : "최근 콘텐츠"}</h2>
                <span className="countChip">{contentItems.length}</span>
              </div>
              <p>{isEn ? "Latest edited posts and drafts" : "최근 수정한 글과 초안 목록"}</p>
            </div>
            <SegmentedToggle role="tablist" aria-label={isEn ? "Filter recent content" : "최근 콘텐츠 필터"}>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === "all"}
                onClick={() => setTableTab("all")}
              >
                {isEn ? "All" : "전체"} ({contentItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === "published"}
                onClick={() => setTableTab("published")}
              >
                {isEn ? "Published" : "발행됨"} ({publishedItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === "draft"}
                onClick={() => setTableTab("draft")}
              >
                {isEn ? "Drafts" : "초안"} ({draftItems.length})
              </button>
            </SegmentedToggle>
          </PanelHeader>

          {visibleContentItems.length > 0 ? (
            <>
              <ContentTableHead aria-hidden="true">
                <span>{isEn ? "Post" : "포스트"}</span>
                <span className="numCol">{isEn ? "Views" : "조회수"}</span>
                <span>{isEn ? "Status" : "상태"}</span>
                <span />
              </ContentTableHead>
              <ContentList aria-label={isEn ? "Recent Content" : "최근 콘텐츠"}>
                {visibleContentItems.map((item) => (
                  <ContentRow
                    as={Link}
                    key={`${item.href}-${item.title}`}
                    href={item.href}
                    data-tone={item.tone || "neutral"}
                    data-status={item.status}
                  >
                    <div className="postMain">
                      <span className="mediaThumb" aria-hidden="true">
                        <AppIcon name="file" width={15} height={15} />
                      </span>
                      <div className="postCopy">
                        <strong className="rowTitle">{item.title}</strong>
                        <span className="rowMeta">{item.meta}</span>
                      </div>
                    </div>
                    <span className="viewsFigure">
                      {typeof item.views === "number" ? item.views.toLocaleString() : "-"}
                    </span>
                    <span className="statusBadgeWrap">
                      <small>
                        <i aria-hidden="true" />
                        {formatAdminHubContentStatus(item.status, isEn)}
                      </small>
                    </span>
                    <span className="rowArrow" aria-hidden="true">
                      <AppIcon name="chevron-right" width={14} height={14} />
                    </span>
                  </ContentRow>
                ))}
              </ContentList>
            </>
          ) : (
            <EmptyPanel>
              <span>{isEn ? "No recent content to display." : "표시할 최근 콘텐츠가 없습니다."}</span>
              <PrimaryActionLink as={Link} href={primaryAction.href}>
                {primaryAction.cta}
              </PrimaryActionLink>
            </EmptyPanel>
          )}
        </Panel>

        <AnalyticsSideStack>
          <Panel>
            <PanelHeader>
              <div className="titleBlock">
                <h2>{isEn ? "Readership Share" : "최근 글 조회 비중"}</h2>
                <p>{isEn ? "Proportional views across recent posts" : "표본 글 기준 상대 조회 분포"}</p>
              </div>
              {contentItems.length > 0 ? (
                <PanelHeaderLink as={Link} href={primaryAction.secondaryHref}>
                  <span>{isEn ? "Manage" : "전체 관리"}</span>
                  <AppIcon name="arrow-right" width={12} height={12} />
                </PanelHeaderLink>
              ) : null}
            </PanelHeader>
            {shareBars.length > 0 ? (
              <ShareBarList aria-label={isEn ? "Recent post view share" : "최근 글 조회 비중"}>
                {shareBars.map((bar) => (
                  <ShareBarItem as={Link} key={`${bar.href}-${bar.title}`} href={bar.href}>
                    <ShareBarFill $widthPct={bar.widthPct} aria-hidden="true" />
                    <ShareBarCopy className="shareBarTitle">{bar.title}</ShareBarCopy>
                    <ShareBarValue>
                      {bar.views.toLocaleString()} ({bar.sharePct}%)
                    </ShareBarValue>
                  </ShareBarItem>
                ))}
              </ShareBarList>
            ) : (
              <EmptyPanel>
                <span>{isEn ? "No recent post view data." : "집계된 최근 글 조회 데이터가 없습니다."}</span>
              </EmptyPanel>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="titleBlock">
                <div className="titleInline">
                  <h2>{isEn ? "Service Status" : "서비스 상태 및 활동"}</h2>
                  <span className="countChip">
                    {healthyChecks}/{serviceStatusItems.length}
                  </span>
                </div>
                <p>{isEn ? "Runtime dependencies and queue summary" : "백엔드 의존성과 작업 큐 요약"}</p>
              </div>
              <PanelHeaderLink as={Link} href="/admin/dashboard">
                <span>{isEn ? "Dashboard" : "대시보드"}</span>
                <AppIcon name="arrow-right" width={12} height={12} />
              </PanelHeaderLink>
            </PanelHeader>
            <StatusList aria-label={isEn ? "Service Status" : "서비스 상태"}>
              {serviceStatusItems.map((item) => (
                <StatusRow
                  key={`${item.label}-${item.value}`}
                  data-kind="service"
                  data-tone={item.tone || "neutral"}
                >
                  <span>
                    <i aria-hidden="true" />
                    <b>{item.label}</b>
                  </span>
                  <strong>{item.value}</strong>
                </StatusRow>
              ))}
            </StatusList>
            {activityItems.length > 0 ? (
              <>
                <SubSectionTitle>
                  <h3>{isEn ? "Operational Summary" : "운영 활동"}</h3>
                </SubSectionTitle>
                <ActivityList aria-label={isEn ? "Recent Activity" : "최근 활동"}>
                  {activityItems.map((item) => (
                    <StatusRow
                      key={`${item.label}-${item.value}`}
                      data-kind="activity"
                      data-tone={item.tone || "neutral"}
                    >
                      <span>
                        <i aria-hidden="true" />
                        <b>{item.label}</b>
                      </span>
                      <strong>{item.value}</strong>
                    </StatusRow>
                  ))}
                </ActivityList>
              </>
            ) : null}
          </Panel>
        </AnalyticsSideStack>
      </AnalyticsBand>
    </Main>
  )
}
