// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/page.tsx (MIT), TryGhost/Ghost apps/admin/src/analytics/views/stats/overview/overview.tsx (MIT)
import type { AdminProfile } from "src/hooks/useAdminProfile"
import { formatIsoDateTime } from "src/libs/utils"
import { AdminHubSurfaceSections } from "./AdminHubSurface.sections"
import {
  deriveAdminHubActivityItems,
  deriveAdminHubOperationalMetrics,
  type AdminHubOperationalSnapshot,
  type AdminHubTone,
} from "./AdminHubSurfaceModel"

export type AdminHubPrimaryAction = {
  href: string
  cta: string
  secondaryHref: string
}

export type AdminHubRecentWorkItem = {
  label: string
  value: string
  tone?: AdminHubTone
}

export type AdminHubMetricItem = {
  label: string
  value: string
  detail?: string
  badge?: string
  tone?: AdminHubTone
}

export type AdminHubContentItem = {
  href: string
  title: string
  meta: string
  status: string
  views?: number
  tone?: AdminHubTone
}

export type AdminHubStatusItem = {
  label: string
  value: string
  tone?: AdminHubTone
}

type Props = {
  displayName: string
  greeting: string
  recentWorkSummary?: string
  primaryAction: AdminHubPrimaryAction
  metrics?: AdminHubMetricItem[]
  contentItems?: AdminHubContentItem[]
  serviceStatusItems: AdminHubStatusItem[]
  activityItems?: AdminHubRecentWorkItem[]
  operationalSnapshot?: AdminHubOperationalSnapshot | null
  adminProfile?: AdminProfile | null
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshError?: string | null
}

const AdminHubSurface = ({
  displayName,
  greeting,
  recentWorkSummary,
  primaryAction,
  metrics,
  contentItems,
  serviceStatusItems,
  activityItems,
  operationalSnapshot,
  adminProfile,
  onRefresh,
  isRefreshing,
  refreshError,
}: Props) => {
  const derived =
    metrics && contentItems
      ? { metrics, recentContentItems: contentItems }
      : deriveAdminHubOperationalMetrics({
          posts: operationalSnapshot?.posts,
          dashboard: operationalSnapshot?.dashboard,
        })

  const profileUpdatedText = formatIsoDateTime(adminProfile?.modifiedAt, "미확인")
  const checklist = [
    Boolean(adminProfile?.profileImageUrl),
    Boolean(adminProfile?.profileRole?.trim()),
    Boolean(adminProfile?.profileBio?.trim()),
    Boolean(adminProfile?.homeIntroTitle?.trim()),
    Boolean(adminProfile?.homeIntroDescription?.trim()),
  ]
  const profileCompletion = Math.round(
    (checklist.filter(Boolean).length / Math.max(1, checklist.length)) * 100
  )
  const linkCount =
    (adminProfile?.serviceLinks?.length || 0) +
    (adminProfile?.contactLinks?.length || 0)

  const resolvedSummary =
    recentWorkSummary ??
    (adminProfile
      ? `최근 업데이트 ${profileUpdatedText} · 프로필 ${profileCompletion}% · 연결 ${linkCount}개`
      : "프로필 정보를 불러올 수 없습니다.")

  const resolvedActivity =
    activityItems ??
    deriveAdminHubActivityItems({
      profileUpdatedText,
      profileCompletion,
      linkCount,
      dashboard: operationalSnapshot?.dashboard,
    })

  return (
    <AdminHubSurfaceSections
      displayName={displayName}
      greeting={greeting}
      recentWorkSummary={resolvedSummary}
      primaryAction={primaryAction}
      metrics={derived.metrics}
      contentItems={derived.recentContentItems}
      serviceStatusItems={serviceStatusItems}
      activityItems={resolvedActivity}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      refreshError={refreshError}
    />
  )
}

export default AdminHubSurface
