import Link from "next/link"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import type { AuthMember } from "src/hooks/useAuthSession"
import {
  Chart,
  ChartBar,
  ChartBars,
  HeaderLink,
  HeroActions,
  HeroCopy,
  HeroPanel,
  HeroTop,
  LogLine,
  LogLines,
  Main,
  MetricCard,
  MetricCopy,
  OpsGrid,
  PanelCard,
  PanelHeader,
  PrioritySection,
  PrioritySummary,
  Shell,
  ServiceRail,
  StatusChip,
  StatusDot,
  StatusRow,
  StatusRows,
} from "src/routes/Admin/AdminDashboardWorkspace.styles"
import type {
  DashboardChartBar,
  DashboardKpiCard,
  DashboardLogRow,
  DashboardPriorityRow,
} from "src/routes/Admin/AdminDashboardWorkspaceModel"
import { DashboardRefreshControls } from "src/routes/Admin/AdminDashboardWorkspaceSections"
import AdminShell from "src/routes/Admin/AdminShell"

const PrioritySummaryLink = PrioritySummary.withComponent(Link)

type AdminDashboardWorkspaceViewProps = {
  chartBars: DashboardChartBar[]
  chartEmptyLabel: string
  collectionFailed: boolean
  snapshotCollectionFailed: boolean
  dashboardStatusLabel: string
  dashboardStatusTone: "neutral" | "good" | "warn"
  freshnessLabel: string | null
  initialProfileSnapshot?: AdminProfile | null
  isRefreshing: boolean
  kpiCards: DashboardKpiCard[]
  logRows: DashboardLogRow[]
  onRefresh: () => void
  priorityRows: DashboardPriorityRow[]
  sessionMember: AuthMember
}

export const AdminDashboardWorkspaceView = (props: AdminDashboardWorkspaceViewProps) => {
  const {
    chartBars,
    chartEmptyLabel,
    collectionFailed,
    snapshotCollectionFailed,
    dashboardStatusLabel,
    dashboardStatusTone,
    freshnessLabel,
    initialProfileSnapshot,
    isRefreshing,
    kpiCards,
    logRows,
    onRefresh,
    priorityRows,
    sessionMember,
  } = props

  return (
    <AdminShell currentSection="dashboard" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <Main>
        <Shell>
          <HeroPanel>
            <HeroTop>
              <HeroCopy>
                <span>Operations</span>
                <h1>운영 상태와 복구</h1>
                <p>배포 슬롯, 준비 상태, 실시간 로그와 주요 지표를 확인합니다.</p>
              </HeroCopy>
              <HeroActions>
                <StatusChip data-tone={dashboardStatusTone}>{dashboardStatusLabel}</StatusChip>
                <DashboardRefreshControls
                  freshnessLabel={freshnessLabel}
                  collectionFailed={collectionFailed}
                  isRefreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
                <HeaderLink as={Link} href="/admin/tools">Doctor 실행</HeaderLink>
                <HeaderLink as={Link} href="/admin/tools" data-variant="primary">Rollback</HeaderLink>
              </HeroActions>
            </HeroTop>
          </HeroPanel>

          <ServiceRail data-ui="monitoring-service-rail">
            {kpiCards.map((item) => (
              <MetricCard key={item.key} data-tone={item.tone}>
                <MetricCopy>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </MetricCopy>
              </MetricCard>
            ))}
          </ServiceRail>

          <OpsGrid>
            <PanelCard>
              <PanelHeader>
                <h2>Public read latency</h2>
                {snapshotCollectionFailed ? (
                  <StatusChip data-tone="danger">수집 실패 · 재시도</StatusChip>
                ) : (
                  <StatusChip data-tone={dashboardStatusTone}>LIVE</StatusChip>
                )}
              </PanelHeader>
              <Chart aria-label="운영 스냅샷 기반 지표 차트">
                {chartBars.length ? (
                  <ChartBars>
                    {chartBars.map((bar) => (
                      <ChartBar
                        key={bar.key}
                        aria-label={`${bar.label} ${bar.height}`}
                        data-tone={bar.tone}
                        style={{ height: `${bar.height}%` }}
                      />
                    ))}
                  </ChartBars>
                ) : (
                  <PrioritySummary data-tone={snapshotCollectionFailed ? "warn" : "neutral"}>
                    {chartEmptyLabel}
                  </PrioritySummary>
                )}
              </Chart>
            </PanelCard>

            <PrioritySection>
              <PanelHeader>
                <h2>Steady-state guard</h2>
              </PanelHeader>
              <StatusRows data-ui="dashboard-guard-rows">
                {priorityRows.map((row) => (
                  <StatusRow key={row.key} data-tone={row.tone}>
                    <span>
                      <StatusDot data-tone={row.tone} aria-hidden="true" />
                      <span>
                        <strong>{row.title}</strong>
                        <small>{row.summary}</small>
                      </span>
                    </span>
                    {row.href ? (
                      <PrioritySummaryLink href={row.href} data-tone={row.tone}>
                        {row.actionLabel}
                      </PrioritySummaryLink>
                    ) : (
                      <PrioritySummary data-tone={row.tone}>{row.actionLabel}</PrioritySummary>
                    )}
                  </StatusRow>
                ))}
              </StatusRows>
            </PrioritySection>

            <PanelCard data-size="wide">
              <PanelHeader>
                <h2>Live logs</h2>
                {snapshotCollectionFailed ? (
                  <StatusChip data-tone="danger">수집 실패 · 재시도</StatusChip>
                ) : (
                  <span>Loki · production</span>
                )}
              </PanelHeader>
              <LogLines>
                {logRows.map((row) => (
                  <LogLine key={row.key} data-tone={row.tone}>
                    <span>{row.time}</span>
                    <p>
                      {row.message}
                      <small>{row.detail}</small>
                    </p>
                  </LogLine>
                ))}
              </LogLines>
            </PanelCard>
          </OpsGrid>
        </Shell>
      </Main>
    </AdminShell>
  )
}
