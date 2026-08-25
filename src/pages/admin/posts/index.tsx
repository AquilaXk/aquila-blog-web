import { NextPage } from "next"
import {
  AdminPostWorkspacePage,
  getAdminPostsWorkspacePageProps,
} from "src/routes/Admin/AdminPostsWorkspacePage"
import { InferGetServerSidePropsType } from "next"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

export const getServerSideProps = withSsrMetrics("admin", getAdminPostsWorkspacePageProps)

type AdminPostsPageProps = InferGetServerSidePropsType<typeof getServerSideProps>

const AdminPostsPage: NextPage<AdminPostsPageProps> = (props) => <AdminPostWorkspacePage {...props} />

export default AdminPostsPage
