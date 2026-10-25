import { NextPage } from "next"
import { BaseButton } from "src/routes/Admin/AdminProfileWorkspace.styles.tokens"
import { AdminProfileWorkspaceSections } from "src/routes/Admin/AdminProfileWorkspaceSections"
import { type AdminProfileWorkspacePageProps, useAdminProfileWorkspacePageModel } from "src/routes/Admin/AdminProfileWorkspacePageModel"
import type { ReadyProfileWorkspaceProps } from "src/routes/Admin/AdminProfileWorkspacePageModel"
import { useProfileWorkspace } from "src/hooks/useProfileWorkspace"
import { ErrorState } from "src/design-system/StatePresenters"

const ReadyProfileWorkspace = (props: ReadyProfileWorkspaceProps) => {
  const profileWorkspaceSectionProps = useAdminProfileWorkspacePageModel(props)

  if (!profileWorkspaceSectionProps) return null

  return <AdminProfileWorkspaceSections {...profileWorkspaceSectionProps} />
}

const AdminProfileWorkspacePage: NextPage<AdminProfileWorkspacePageProps> = (props) => {
  const workspaceQuery = useProfileWorkspace(props.initialMember.id, props.initialWorkspace)
  if (workspaceQuery.isPending) return <p role="status">프로필을 불러오는 중입니다.</p>
  if (!workspaceQuery.data) {
    return <ErrorState label="Profile unavailable" title="프로필을 불러오지 못했습니다"
      description="정본 프로필을 확인할 수 없어 편집을 시작하지 않았습니다."
      actions={<BaseButton type="button" style={{ minHeight: 44, minWidth: 44 }} onClick={() => void workspaceQuery.refetch()}>다시 불러오기</BaseButton>} />
  }
  return <>
    {workspaceQuery.isError && <p role="alert">프로필 갱신에 실패했습니다. 편집 중인 내용은 유지됩니다.</p>}
    <ReadyProfileWorkspace {...props} initialWorkspace={workspaceQuery.data} workspaceQuery={workspaceQuery} />
  </>
}

export default AdminProfileWorkspacePage
