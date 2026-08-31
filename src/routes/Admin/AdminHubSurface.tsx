import { AdminHubSurfaceSections } from "./AdminHubSurface.sections"

export type AdminHubPrimaryAction = {
  href: string
  cta: string
  secondaryHref: string
}

export type AdminHubRecentWorkItem = {
  label: string
  value: string
  tone?: "neutral" | "good" | "warn"
}

export type AdminHubMetricItem = {
  label: string
  value: string
  detail?: string
  tone?: "neutral" | "good" | "warn"
}

export type AdminHubContentItem = {
  href: string
  title: string
  meta: string
  status: string
  tone?: "neutral" | "good" | "warn"
}

export type AdminHubStatusItem = {
  label: string
  value: string
  tone?: "neutral" | "good" | "warn"
}

type Props = {
  displayName: string
  greeting: string
  recentWorkSummary: string
  primaryAction: AdminHubPrimaryAction
  metrics: AdminHubMetricItem[]
  contentItems: AdminHubContentItem[]
  serviceStatusItems: AdminHubStatusItem[]
  activityItems: AdminHubRecentWorkItem[]
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
}: Props) => {
  return (
    <AdminHubSurfaceSections
      displayName={displayName}
      greeting={greeting}
      recentWorkSummary={recentWorkSummary}
      primaryAction={primaryAction}
      metrics={metrics}
      contentItems={contentItems}
      serviceStatusItems={serviceStatusItems}
      activityItems={activityItems}
    />
  )
}

export default AdminHubSurface
