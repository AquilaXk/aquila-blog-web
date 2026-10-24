import type { AuthMember } from "src/hooks/useAuthSession"
import type { AdminProfile } from "src/types/adminProfile"
import AdminShell from "src/routes/Admin/AdminShell"
import {
  AdminToolsDiagnosticsSection,
  type AdminToolsDiagnosticsSectionProps,
} from "src/routes/Admin/AdminToolsDiagnosticsSection"
import {
  AdminToolsExecutionSection,
  type AdminToolsExecutionSectionProps,
} from "src/routes/Admin/AdminToolsExecutionSection"
import {
  AdminToolsOpsOverview,
  type AdminToolsOpsOverviewProps,
} from "src/routes/Admin/AdminToolsOpsOverview"
import AdminToolsResultsPanel from "src/routes/Admin/AdminToolsResultsPanel"
import type {
  ExecutionEntry,
  ExecutionResultFilter,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import {
  Main,
  WorkspaceColumn,
  WorkspaceShell,
} from "src/routes/Admin/AdminToolsWorkspace.styles"

export type AdminToolsWorkspaceSectionsProps = AdminToolsOpsOverviewProps &
  Omit<AdminToolsDiagnosticsSectionProps, "isBusy"> &
  Omit<AdminToolsExecutionSectionProps, "isBusy"> & {
    executions: ExecutionEntry[]
    filteredExecutions: ExecutionEntry[]
    freshnessClock: number | null
    initialProfileSnapshot?: AdminProfile | null
    resultFilterCounts: Record<ExecutionResultFilter, number>
    resultsFilter: ExecutionResultFilter
    selectedExecution: ExecutionEntry | null
    sessionMember: AuthMember
    setResultsFilter: (filter: ExecutionResultFilter) => void
    setSelectedExecutionId: (id: string | null) => void
  }

export const AdminToolsWorkspaceSections = (props: AdminToolsWorkspaceSectionsProps) => {
  const {
    executions,
    filteredExecutions,
    freshnessClock,
    initialProfileSnapshot,
    loadingKey,
    resultFilterCounts,
    resultsFilter,
    selectedExecution,
    sessionMember,
    setResultsFilter,
    setSelectedExecutionId,
  } = props

  return (
    <AdminShell currentSection="tools" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <Main>
        <AdminToolsOpsOverview {...props} loadingKey={loadingKey} />

        <WorkspaceShell>
          <WorkspaceColumn>
            <AdminToolsDiagnosticsSection
              {...props}
              isBusy={Boolean(loadingKey)}
            />
            <AdminToolsExecutionSection
              {...props}
              isBusy={Boolean(loadingKey)}
            />
            <AdminToolsResultsPanel
              executions={executions}
              filteredExecutions={filteredExecutions}
              freshnessClock={freshnessClock}
              onResultFilterChange={setResultsFilter}
              onSelectedExecutionChange={setSelectedExecutionId}
              resultFilterCounts={resultFilterCounts}
              resultsFilter={resultsFilter}
              selectedExecution={selectedExecution}
            />
          </WorkspaceColumn>
        </WorkspaceShell>
      </Main>
    </AdminShell>
  )
}
