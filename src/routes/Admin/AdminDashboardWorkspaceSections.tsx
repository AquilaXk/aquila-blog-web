// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/site-header.tsx (MIT)
import AppIcon from "./AdminAppIcon"
import {
  DASHBOARD_COLLECTION_FAILED_LABEL,
  DASHBOARD_REFRESH_LABEL,
  DASHBOARD_REFRESHING_LABEL,
} from "src/routes/Admin/AdminDashboardWorkspaceModel"
import {
  FreshnessLabel,
  RefreshButton,
  StatusChip,
} from "src/routes/Admin/AdminDashboardWorkspace.styles"

type DashboardRefreshControlsProps = {
  freshnessLabel: string | null
  collectionFailed: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

export const DashboardRefreshControls = ({
  freshnessLabel,
  collectionFailed,
  isRefreshing,
  onRefresh,
}: DashboardRefreshControlsProps) => (
  <>
    {freshnessLabel ? <FreshnessLabel>{freshnessLabel}</FreshnessLabel> : null}
    {collectionFailed ? (
      <StatusChip data-tone="danger" role="status" aria-label={DASHBOARD_COLLECTION_FAILED_LABEL}>
        {DASHBOARD_COLLECTION_FAILED_LABEL}
      </StatusChip>
    ) : null}
    <RefreshButton
      type="button"
      aria-label={isRefreshing ? DASHBOARD_REFRESHING_LABEL : DASHBOARD_REFRESH_LABEL}
      aria-busy={isRefreshing ? "true" : "false"}
      disabled={isRefreshing}
      onClick={onRefresh}
    >
      <AppIcon name="refresh" width={14} height={14} />
      <span>{isRefreshing ? DASHBOARD_REFRESHING_LABEL : DASHBOARD_REFRESH_LABEL}</span>
    </RefreshButton>
  </>
)
