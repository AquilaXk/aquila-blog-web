import type { GetServerSideProps, NextPage } from "next"
import type { AuthMember } from "src/hooks/useAuthSession"
import {
  buildAdminPagePropsFromMember,
  getAdminPageProps,
  readAdminProtectedBootstrap,
  type AdminPageProps,
} from "src/libs/server/adminPage"
import { hasServerAuthCookie } from "src/libs/server/authSession"
import type { AdminProfile } from "src/types/adminProfile"
import { EditorStudioWorkspaceController } from "./EditorStudioWorkspaceController"

const EDITOR_NEW_ROUTE_PATH = "/admin/editor/new"

export type EditorStudioPageProps = AdminPageProps

export const getEditorStudioPageProps: GetServerSideProps<EditorStudioPageProps> = async ({ req }) => {
  // Playwright/QA는 BACKEND_INTERNAL_URL=127.0.0.1:1 단절 모드에서 cookie 없이
  // getAdminPageProps(QA bypass)로 editor shell을 띄운다. auth cookie가 없을 때
  // bootstrap을 호출하면 ApiNetworkError가 GSSP를 500으로 터뜨린다.
  if (hasServerAuthCookie(req)) {
    const bootstrapResult = await readAdminProtectedBootstrap<{
      member: AuthMember
      profile: AdminProfile
    }>(req, "/member/api/v1/adm/members/bootstrap", EDITOR_NEW_ROUTE_PATH)

    if (bootstrapResult.ok) {
      const { member, profile } = bootstrapResult.value
      return {
        props: buildAdminPagePropsFromMember(member, profile),
      }
    }

    if (bootstrapResult.destination) {
      return {
        redirect: {
          destination: bootstrapResult.destination,
          permanent: false,
        },
      }
    }
  }

  return await getAdminPageProps(req)
}

export const EditorStudioPage: NextPage<EditorStudioPageProps> = (props) => (
  <EditorStudioWorkspaceController {...props} />
)

export default EditorStudioPage
