import { IncomingMessage } from "http"
import type { ProfileWorkspaceResponse } from "src/libs/profileWorkspace"
import { serverApiFetchJson } from "./backend"

export const fetchServerProfileWorkspace = async (
  req: IncomingMessage,
  memberId: number
): Promise<ProfileWorkspaceResponse> => {
  const workspace = await serverApiFetchJson<ProfileWorkspaceResponse>(
    req,
    `/member/api/v1/adm/members/${memberId}/profileWorkspace`
  )
  if (!workspace) throw new Error("Profile workspace response is empty")
  return workspace
}
