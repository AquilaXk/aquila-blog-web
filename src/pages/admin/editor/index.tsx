import type { NextPage } from "next"
import type { AdminPageProps } from "src/libs/server/adminPage"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import { EditorStudioPage, getEditorStudioPageProps } from "src/routes/Admin/EditorStudioPage"

export const getServerSideProps = withSsrMetrics("editor", getEditorStudioPageProps)

const EditorIndexPage: NextPage<AdminPageProps> = (props) => <EditorStudioPage {...props} />

export default EditorIndexPage
