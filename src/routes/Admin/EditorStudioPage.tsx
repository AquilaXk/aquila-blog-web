import type { GetServerSideProps, NextPage } from "next"
import type { AuthMember } from "src/hooks/useAuthSession"
import {
  buildAdminPagePropsFromMember,
  getAdminPageProps,
  readAdminProtectedBootstrap,
  type AdminPageProps,
} from "src/libs/server/adminPage"
import { hasServerAuthCookie } from "src/libs/server/authSession"
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
      profile: Partial<AuthMember>
    }>(req, "/member/api/v1/adm/members/bootstrap", EDITOR_NEW_ROUTE_PATH)

    if (bootstrapResult.ok) {
      const { member, profile } = bootstrapResult.value
      const mergedMember: AuthMember = {
        ...member,
        profileImageDirectUrl:
          profile.profileImageDirectUrl ||
          profile.profileImageUrl ||
          member.profileImageDirectUrl ||
          member.profileImageUrl ||
          "",
        profileImageUrl:
          profile.profileImageUrl ||
          profile.profileImageDirectUrl ||
          member.profileImageUrl ||
          member.profileImageDirectUrl ||
          "",
        profileRole: profile.profileRole || member.profileRole || "",
        profileBio: profile.profileBio || member.profileBio || "",
        aboutRole: profile.aboutRole || member.aboutRole || "",
        aboutBio: profile.aboutBio || member.aboutBio || "",
        aboutDetails: profile.aboutDetails || member.aboutDetails || "",
        blogTitle: profile.blogTitle || member.blogTitle || "",
        homeIntroTitle: profile.homeIntroTitle || member.homeIntroTitle || "",
        homeIntroDescription:
          profile.homeIntroDescription || member.homeIntroDescription || "",
      }

      const baseProps = buildAdminPagePropsFromMember(mergedMember)

      return {
        props: {
          ...baseProps,
        },
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
