import type { NextPage } from "next"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import {
  EditorStudioPage,
  getEditorStudioPageProps,
  type EditorStudioPageProps,
} from "src/routes/Admin/EditorStudioPage"

export const getServerSideProps = withSsrMetrics("editor", getEditorStudioPageProps)

const EditorPostPage: NextPage<EditorStudioPageProps> = (props) => <EditorStudioPage {...props} />

export default EditorPostPage
