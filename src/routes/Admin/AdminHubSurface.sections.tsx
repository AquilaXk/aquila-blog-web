/**
 * 참조 구현:
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/{page.tsx,components/section-cards.tsx,components/chart-area-interactive.tsx,components/data-table.tsx} (MIT License, Copyright (c) shadcn)
 * - TryGhost/Ghost apps/admin/src/{analytics/views/stats/overview/overview.tsx,posts/list/components/post-list-row.tsx} (MIT License, Copyright (c) Ghost Foundation)
 */
import Link from "next/link"
import { useState } from "react"
import { useLanguage } from "src/libs/language"
import {
  adminChartAreaBottom,
  adminChartAreaTop,
  adminChartGrid,
  adminChartStroke,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
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
  ChartCanvasWrap,
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
  PrimaryActionLink,
  SecondaryActionLink,
  SegmentedToggle,
  StatusList,
  StatusRow,
} from "./AdminHubSurface.styles"
import {
  buildAdminHubAreaGeometry,
  HUB_CHART_BASELINE,
  HUB_CHART_LEFT,
  HUB_CHART_RIGHT,
  HUB_CHART_TOP,
  truncateAdminHubChartLabel,
} from "./AdminHubSurfaceModel"

const resolveChartAxisDateOrTitle = (
  meta: string | undefined,
  title: string,
  maxChars: number
): string => {
  if (meta) {
    const isoDateMatch = /(\d{4})[-.](\d{2})[-.](\d{2})/.exec(meta)
    if (isoDateMatch) {
      return `${isoDateMatch[2]}.${isoDateMatch[3]}`
    }
    const monthDayMatch = /(\d{1,2})\.\s*(\d{1,2})/.exec(meta)
    if (monthDayMatch) {
      return `${monthDayMatch[1]!.padStart(2, "0")}.${monthDayMatch[2]!.padStart(2, "0")}`
    }
  }
  return truncateAdminHubChartLabel(title, maxChars)
}

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
  const [chartMode, setChartMode] = useState<"area" | "bar">("area")
  const [tableTab, setTableTab] = useState<"all" | "published" | "draft" | "status">("all")

  const chartSeries = contentItems.map((item) => ({
    title: item.title,
    meta: item.meta,
    views: typeof item.views === "number" && Number.isFinite(item.views) ? item.views : 0,
  }))
  const totalSampleViews = chartSeries.reduce((acc, item) => acc + item.views, 0)
  const { strokePath, areaPath, coords, maxVal } = buildAdminHubAreaGeometry(
    chartSeries.map((item) => item.views)
  )
  const midVal = Math.round(maxVal / 2)

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
            <span className="cardDescription">{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <div className="cardFooter">{item.detail}</div> : null}
          </MetricCard>
        ))}
      </MetricGrid>

      <AnalyticsBand>
        <Panel data-span="full">
          <PanelHeader>
            <div className="titleBlock">
              <h2>{isEn ? "Content Readership Distribution" : "콘텐츠 열람 분포"}</h2>
              <p>{isEn ? "View share across recently updated posts" : "최근 수정 포스트별 조회 추이"}</p>
            </div>
            <SegmentedToggle role="group" aria-label={isEn ? "Chart mode" : "차트 보기 방식"}>
              <button
                type="button"
                aria-pressed={chartMode === "area"}
                onClick={() => setChartMode("area")}
              >
                {isEn ? "Area" : "영역 차트"}
              </button>
              <button
                type="button"
                aria-pressed={chartMode === "bar"}
                onClick={() => setChartMode("bar")}
              >
                {isEn ? "Bars" : "막대 비교"}
              </button>
            </SegmentedToggle>
          </PanelHeader>
          <ChartCanvasWrap>
            <svg
              viewBox="0 0 600 185"
              role="img"
              aria-label={isEn ? "Recent post views chart" : "최근 수정 포스트별 조회 분포 차트"}
            >
              <defs>
                <linearGradient id="adminHubAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" style={{ stopColor: adminChartAreaTop }} />
                  <stop offset="95%" style={{ stopColor: adminChartAreaBottom }} />
                </linearGradient>
              </defs>

              {[24, 86, 117].map((gridY) => (
                <line
                  key={`grid-${gridY}`}
                  x1={HUB_CHART_LEFT}
                  y1={gridY}
                  x2={HUB_CHART_RIGHT}
                  y2={gridY}
                  stroke={adminChartGrid}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              ))}
              <line
                x1={HUB_CHART_LEFT}
                y1={HUB_CHART_BASELINE}
                x2={HUB_CHART_RIGHT}
                y2={HUB_CHART_BASELINE}
                stroke={adminChartGrid}
                strokeWidth="1"
              />

              <text x="6" y="28" fill={adminTextMuted} fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {coords.length > 0 ? maxVal.toLocaleString() : "0"}
              </text>
              {coords.length > 0 && midVal > 0 ? (
                <text x="6" y="89" fill={adminTextMuted} fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                  {midVal.toLocaleString()}
                </text>
              ) : null}
              <text x="6" y={HUB_CHART_BASELINE + 3} fill={adminTextMuted} fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                0
              </text>

              {coords.length === 0 ? (
                <>
                  <line
                    x1={HUB_CHART_LEFT}
                    y1={HUB_CHART_BASELINE}
                    x2={HUB_CHART_RIGHT}
                    y2={HUB_CHART_BASELINE}
                    stroke={adminChartStroke}
                    strokeDasharray="4 4"
                    strokeWidth="1.75"
                    opacity="0.4"
                  />
                  <text
                    x={(HUB_CHART_LEFT + HUB_CHART_RIGHT) / 2}
                    y="92"
                    textAnchor="middle"
                    fill={adminTextMuted}
                    fontSize="12"
                  >
                    {isEn ? "0 baseline · No recent posts yet" : "0 기준선 · 집계된 최근 포스트 없음"}
                  </text>
                </>
              ) : chartMode === "area" ? (
                <>
                  <path d={areaPath} fill="url(#adminHubAreaFill)" />
                  <path
                    d={strokePath}
                    fill="none"
                    stroke={adminChartStroke}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {coords.map((pt, idx) => (
                    <g key={`pt-${idx}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="3"
                        fill={adminSurface}
                        stroke={adminChartStroke}
                        strokeWidth="1.75"
                      />
                      <text
                        x={pt.x}
                        y="170"
                        textAnchor="middle"
                        fill={adminTextSecondary}
                        fontSize="10.5"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {resolveChartAxisDateOrTitle(
                          chartSeries[idx]?.meta,
                          chartSeries[idx]?.title || "",
                          coords.length === 1 ? 22 : 10
                        )}
                      </text>
                    </g>
                  ))}
                </>
              ) : (
                coords.map((pt, idx) => {
                  const barWidth =
                    coords.length === 1
                      ? 44
                      : Math.min(44, Math.max(20, 320 / Math.max(1, coords.length)))
                  const rawHeight = HUB_CHART_BASELINE - pt.y
                  const barHeight = pt.val > 0 ? Math.max(6, rawHeight) : 3
                  return (
                    <g key={`bar-${idx}`}>
                      <rect
                        x={pt.x - barWidth / 2}
                        y={HUB_CHART_TOP}
                        width={barWidth}
                        height={HUB_CHART_BASELINE - HUB_CHART_TOP}
                        rx="4"
                        fill={adminSurfaceMuted}
                      />
                      <rect
                        x={pt.x - barWidth / 2}
                        y={HUB_CHART_BASELINE - barHeight}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill={adminChartStroke}
                        opacity={pt.val > 0 ? 1 : 0.35}
                      />
                      {coords.length === 1 ? (
                        <text
                          x={pt.x}
                          y={Math.max(HUB_CHART_TOP - 4, HUB_CHART_BASELINE - barHeight - 6)}
                          textAnchor="middle"
                          fill={adminTextPrimary}
                          fontSize="10"
                          fontWeight="600"
                        >
                          {pt.val.toLocaleString()}
                        </text>
                      ) : null}
                      <text
                        x={pt.x}
                        y="170"
                        textAnchor="middle"
                        fill={adminTextSecondary}
                        fontSize="10.5"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {resolveChartAxisDateOrTitle(
                          chartSeries[idx]?.meta,
                          chartSeries[idx]?.title || "",
                          coords.length === 1 ? 22 : 10
                        )}
                      </text>
                    </g>
                  )
                })
              )}
            </svg>
            <div className="chartFooter">
              <span>
                {isEn ? "Sampled posts" : "표본 포스트"}: <strong>{chartSeries.length}</strong>
              </span>
              <span>
                {isEn ? "Sampled views" : "표본 조회 합계"}:{" "}
                <strong>{totalSampleViews.toLocaleString()}</strong>
              </span>
            </div>
          </ChartCanvasWrap>
        </Panel>

        <Panel data-span="full">
          <PanelHeader>
            <SegmentedToggle role="tablist" aria-label={isEn ? "Recent content views" : "최근 콘텐츠 보기 전환"}>
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
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === "status"}
                onClick={() => setTableTab("status")}
              >
                {isEn ? "Service Status" : "서비스 상태"} ({healthyChecks}/{serviceStatusItems.length})
              </button>
            </SegmentedToggle>
            <PrimaryActionLink as={Link} href={primaryAction.href}>
              <span>+ {primaryAction.cta}</span>
            </PrimaryActionLink>
          </PanelHeader>

          {tableTab === "status" ? (
            <>
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
              ) : null}
            </>
          ) : visibleContentItems.length > 0 ? (
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
                        {item.status}
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
      </AnalyticsBand>
    </Main>
  )
}
