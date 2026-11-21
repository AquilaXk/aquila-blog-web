import { apiFetch } from "src/apis/backend/client"
import {
  type ProfileWorkspaceContent,
  type ProfileWorkspaceResponse,
} from "src/libs/profileWorkspace"

export type ProfileImageUploadResponse = {
  profileImageUrl: string
}

export const parseProfileImageUploadResponse = (payload: unknown): ProfileImageUploadResponse => {
  const profileImageUrl =
    payload && typeof payload === "object" && "profileImageUrl" in payload
      ? (payload as { profileImageUrl?: unknown }).profileImageUrl
      : undefined
  if (typeof profileImageUrl !== "string" || !profileImageUrl.trim()) {
    throw new Error("이미지 업로드 응답에 profileImageUrl이 없습니다.")
  }
  return { profileImageUrl: profileImageUrl.trim() }
}

export const saveProfileWorkspaceImage = async (
  memberId: number,
  currentDraft: ProfileWorkspaceContent,
  profileImageUrl: string
): Promise<ProfileWorkspaceResponse> => {
  const nextWorkspace = await apiFetch<ProfileWorkspaceResponse | null>(
    `/member/api/v1/adm/members/${memberId}/profileWorkspace/draft`,
    {
      method: "PUT",
      body: JSON.stringify({ ...currentDraft, profileImageUrl }),
    }
  )
  if (!nextWorkspace) {
    throw new Error("프로필 이미지 저장의 canonical 응답이 없습니다.")
  }
  return nextWorkspace
}

export const reconcileProfileWorkspaceDraft = (
  currentDraft: ProfileWorkspaceContent,
  previousRemoteDraft: ProfileWorkspaceContent,
  nextRemoteDraft: ProfileWorkspaceContent
): ProfileWorkspaceContent =>
  JSON.stringify(currentDraft) === JSON.stringify(previousRemoteDraft)
    ? nextRemoteDraft
    : currentDraft
