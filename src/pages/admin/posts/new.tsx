import { GetServerSideProps, NextPage } from "next"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

export const getServerSideProps: GetServerSideProps = withSsrMetrics("admin", async () => {
  return {
    redirect: {
      destination: "/admin/posts",
      permanent: false,
    },
  }
})

const AdminPostsNewRedirectPage: NextPage = () => null

export default AdminPostsNewRedirectPage
