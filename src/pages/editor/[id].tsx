import { NextPage } from "next"
import {
  EditorStudioPage,
  getEditorStudioPageProps,
  type EditorStudioPageProps,
} from "src/routes/Admin/EditorStudioPage"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

export const getServerSideProps = withSsrMetrics("editor", getEditorStudioPageProps)

const EditorPostPage: NextPage<EditorStudioPageProps> = (props) => <EditorStudioPage {...props} />

export default EditorPostPage
