// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/{QueueCard.tsx,QueueStats/QueueStats.tsx} (MIT), felixmosh/bull-board packages/ui/src/components/StatusMenu/StatusMenu.tsx (MIT), medusajs/medusa packages/design-system/ui/src/components/code-block/code-block.tsx (MIT)
import Link from "next/link"
import { useState } from "react"
import AppIcon from "./AdminAppIcon"
import { useLanguage } from "src/libs/language"
import { AdminBullQueueCards, type BullQueueCardItem } from "src/routes/Admin/AdminBullQueueCards"
import {
  Chart,
  ChartBar,
  ChartBarColumn,
  ChartBarLabel,
  ChartBars,
  ChartBarTrack,
  ChartBarValue,
  HeaderLink,
  HeroActions,
  HeroCopy,
  HeroPanel,
  HeroTop,
  LogLine,
  LogLines,
  Main,
  OpsGrid,
  PanelCard,
  PanelHeader,
  PrioritySection,
  PrioritySummary,
  Shell,
  StatusChip,
  StatusDot,
  StatusMenuList,
  StatusMenuTab,
  StatusRow,
  StatusRows,
  TerminalCard,
  TerminalHeader,
} from "src/routes/Admin/AdminDashboardWorkspace.styles"
import type {
  DashboardChartBar,
  DashboardKpiCard,
  DashboardLogRow,
  DashboardPriorityRow,
  DashboardTone,
} from "src/routes/Admin/AdminDashboardWorkspaceModel"
import { DashboardRefreshControls } from "src/routes/Admin/AdminDashboardWorkspaceSections"
import AdminShell from "src/routes/Admin/AdminShell"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import type { AuthMember } from "src/hooks/useAuthSession"

const PrioritySummaryLink = PrioritySummary.withComponent(Link)

type AdminDashboardWorkspaceViewProps = {
  chartBars: DashboardChartBar[]
  chartEmptyLabel: string
  collectionFailed: boolean
  snapshotCollectionFailed: boolean
  dashboardStatusLabel: string
  dashboardStatusTone: DashboardTone
  freshnessLabel: string | null
  initialProfileSnapshot?: AdminProfile | null
  isRefreshing: boolean
  kpiCards: DashboardKpiCard[]
  logRows: DashboardLogRow[]
  onRefresh: () => void
  priorityRows: DashboardPriorityRow[]
  sessionMember: AuthMember
}

const resolveLogLevelTag = (tone: DashboardTone) => {
  if (tone === "danger") return "[오류]"
  if (tone === "warn") return "[주의]"
  return "[정상]"
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

  const { language } = useLanguage()
  const isEn = language === "en"
  const [guardFilter, setGuardFilter] = useState<"all" | "attention" | "healthy">("all")

  const valueByKey = new Map(chartBars.map((item) => [item.key, item.value]))
  const readyVal = valueByKey.get("ready") ?? 0
  const failedVal = valueByKey.get("failed") ?? 0
  const purgeVal = valueByKey.get("purge") ?? 0
  const authBlockedVal = valueByKey.get("auth-blocked") ?? 0

  const queueCards: BullQueueCardItem[] = kpiCards.map((item) => {
    const keyLower = item.key.toLowerCase()
    const segments = keyLower.includes("queue") || keyLower.includes("tasks")
      ? [
          { key: "ready", label: isEn ? "Ready" : "대기", value: readyVal, tone: "info" as const },
          { key: "failed", label: isEn ? "Failed" : "실패", value: failedVal, tone: "danger" as const },
        ]
      : keyLower.includes("purge") || keyLower.includes("clean") || keyLower.includes("storage")
        ? purgeVal > 0
          ? [{ key: "purge", label: isEn ? "Purge" : "정리 대상", value: purgeVal, tone: "warn" as const }]
          : []
        : keyLower.includes("auth") || keyLower.includes("sec")
          ? authBlockedVal > 0
            ? [{ key: "blocked", label: isEn ? "Blocked" : "차단", value: authBlockedVal, tone: "danger" as const }]
            : []
          : []
    return {
      key: item.key,
      title: item.label,
      subtitle: item.detail,
      valueText: item.value,
      badgeText: item.badge || item.key,
      tone: item.tone,
      actionLabel:
        keyLower.includes("queue") || keyLower.includes("tasks")
          ? isEn
            ? "Inspect"
            : "진단 보기"
          : undefined,
      actionHref:
        keyLower.includes("queue") || keyLower.includes("tasks") ? "/admin/tools?tab=queue" : undefined,
      segments,
    }
  })

  const attentionRows = priorityRows.filter((row) => row.tone === "warn" || row.tone === "danger")
  const healthyRows = priorityRows.filter((row) => row.tone === "good" || row.tone === "neutral")
  const visibleGuardRows =
    guardFilter === "attention" ? attentionRows : guardFilter === "healthy" ? healthyRows : priorityRows

  return (
    <AdminShell currentSection="dashboard" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <Main>
        <Shell>
          <HeroPanel>
            <HeroTop>
              <HeroCopy>
                <h1>{isEn ? "Operations & Recovery" : "운영 상태와 복구"}</h1>
                <StatusChip data-tone={dashboardStatusTone}>
                  <StatusDot data-tone={dashboardStatusTone} aria-hidden="true" />
                  <span>{dashboardStatusLabel}</span>
                </StatusChip>
              </HeroCopy>
              <HeroActions>
                <DashboardRefreshControls
                  freshnessLabel={freshnessLabel}
                  collectionFailed={collectionFailed}
                  isRefreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
                <HeaderLink as={Link} href="/admin/tools?tab=queue">
                  {isEn ? "Queue Diagnostics" : "상태 진단"}
                </HeaderLink>
                <HeaderLink as={Link} href="/admin/tools?tab=cleanup" data-variant="primary">
                  {isEn ? "Recovery Tools" : "복구 도구"}
                </HeaderLink>
              </HeroActions>
            </HeroTop>
          </HeroPanel>

          <AdminBullQueueCards
            ariaLabel={isEn ? "Operations Queue Cards" : "운영 서브시스템 큐 카드"}
            cards={queueCards}
          />

          <OpsGrid>
            <PanelCard>
              <PanelHeader>
                <h2>{isEn ? "Operational Metrics" : "운영 지표 요약"}</h2>
                <StatusChip data-tone={snapshotCollectionFailed ? "warn" : dashboardStatusTone}>
                  <StatusDot
                    data-tone={snapshotCollectionFailed ? "warn" : dashboardStatusTone}
                    aria-hidden="true"
                  />
                  <span>
                    {snapshotCollectionFailed
                      ? isEn
                        ? "Delayed"
                        : "일부 지연"
                      : isEn
                        ? "Healthy"
                        : "실시간"}
                  </span>
                </StatusChip>
              </PanelHeader>
              <Chart aria-label="운영 스냅샷 기반 지표 차트">
                {chartBars.length ? (
                  <ChartBars>
                    {chartBars.map((bar) => {
                      const isZero = bar.value === 0
                      return (
                        <ChartBarColumn key={bar.key}>
                          <ChartBarLabel>
                            <StatusDot data-tone={bar.tone} aria-hidden="true" />
                            {bar.label}
                          </ChartBarLabel>
                          <ChartBarTrack>
                            <ChartBar
                              aria-label={`${bar.label} ${bar.value}건`}
                              data-tone={bar.tone}
                              data-zero={isZero ? "true" : undefined}
                              style={isZero ? { width: "0%" } : { width: `${bar.height}%` }}
                            />
                          </ChartBarTrack>
                          <ChartBarValue data-zero={isZero ? "true" : undefined}>
                            {`${bar.value}건`}
                          </ChartBarValue>
                        </ChartBarColumn>
                      )
                    })}
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
                <h2>{isEn ? "Subsystem Checks" : "서브시스템 점검 항목"}</h2>
                <span className="monoTag">{isEn ? "Checks" : "모니터링"}</span>
              </PanelHeader>
              <StatusMenuList role="tablist" aria-label="가드 상태 필터">
                <StatusMenuTab
                  type="button"
                  role="tab"
                  aria-selected={guardFilter === "all"}
                  onClick={() => setGuardFilter("all")}
                >
                  {isEn ? "All" : "전체"} ({priorityRows.length})
                </StatusMenuTab>
                <StatusMenuTab
                  type="button"
                  role="tab"
                  aria-selected={guardFilter === "attention"}
                  onClick={() => setGuardFilter("attention")}
                >
                  {isEn ? "Attention" : "주의 필요"} ({attentionRows.length})
                </StatusMenuTab>
                <StatusMenuTab
                  type="button"
                  role="tab"
                  aria-selected={guardFilter === "healthy"}
                  onClick={() => setGuardFilter("healthy")}
                >
                  {isEn ? "Healthy" : "정상"} ({healthyRows.length})
                </StatusMenuTab>
              </StatusMenuList>
              <StatusRows data-ui="dashboard-guard-rows">
                {visibleGuardRows.map((row) => (
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

            <TerminalCard data-size="wide">
              <TerminalHeader>
                <div className="terminalTitleGroup">
                  <AppIcon name="list" width={15} height={15} />
                  <h2>{isEn ? "Recent Events" : "최근 운영 이벤트"}</h2>
                </div>
              </TerminalHeader>
              <LogLines>
                {logRows.map((row) => (
                  <LogLine key={row.key} data-tone={row.tone}>
                    <span className="logTimestamp">[{row.time}]</span>
                    <span className="logLevel">{resolveLogLevelTag(row.tone)}</span>
                    <p>
                      <span>{row.message}</span>
                      <small>{row.detail}</small>
                    </p>
                  </LogLine>
                ))}
              </LogLines>
            </TerminalCard>
          </OpsGrid>
        </Shell>
      </Main>
    </AdminShell>
  )
}
