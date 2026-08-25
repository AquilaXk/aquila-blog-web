import { NextPage } from "next"
import { AdminPageProps } from "src/libs/server/adminPage"
import { EditorStudioPage, getEditorStudioPageProps } from "src/routes/Admin/EditorStudioPage"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

export const getServerSideProps = withSsrMetrics("editor", getEditorStudioPageProps)

const EditorNewPage: NextPage<AdminPageProps> = (props) => <EditorStudioPage {...props} />

export default EditorNewPage
