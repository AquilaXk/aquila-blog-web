import type { RefObject } from "react"
import type { AuthMember } from "src/hooks/useAuthSession"
import type { AdminProfile } from "src/types/adminProfile"
import AdminShell from "./AdminShell"
import { AdminPostsWorkspaceFeedbackLayer } from "./AdminPostsWorkspaceFeedbackLayer"
import { AdminPostsWorkspaceFilterToolbar } from "./AdminPostsWorkspaceFilterToolbar"
import { AdminPostsWorkspaceList } from "./AdminPostsWorkspaceList"
import {
  DEFAULT_PAGE,
  type AdminPostListItem,
  type ListSort,
  type ListState,
  type PostListScope,
  type PostStatusFilter,
  type WorkspaceConfirmState,
  type WorkspaceToastState,
} from "./AdminPostsWorkspaceModel"
import {
  HeroSection,
  ListSection,
  Main,
  PostsHeroCopy,
  PrimaryCta,
  WorkspaceBody,
  WorkspaceMain,
} from "./AdminPostsWorkspacePageSections"
import { AdminWorkspaceHeroActions, AdminWorkspaceHeroLayout } from "./AdminSurfacePrimitives"

export type AdminPostsWorkspacePageViewProps = {
  confirmState: WorkspaceConfirmState
  handleConfirmAction: () => void | Promise<void>
  handleToastAction: () => void | Promise<void>
  initialProfileSnapshot?: AdminProfile | null
  isListLoading: boolean
  listError: string
  listKw: string
  listPage: string
  listPageSize: string
  listScope: PostListScope
  listStatus: PostStatusFilter
  listSectionRef: RefObject<HTMLElement | null>
  listSort: ListSort
  listState: ListState
  loadList: () => void | Promise<void>
  mutationPending: { rowId: number; kind: "delete" | "restore" | "hardDelete" } | null
  handleDeletePost: (row: AdminPostListItem) => void | Promise<void>
  onHardDeletePost: (row: AdminPostListItem) => void | Promise<void>
  onRestorePost: (row: AdminPostListItem) => void | Promise<void>
  openWriteRoute: (query?: Record<string, string>) => void | Promise<void>
  sessionMember: AuthMember
  setConfirmState: (value: WorkspaceConfirmState) => void
  setListKw: (value: string) => void
  setListPage: (value: string) => void
  setListStatus: (value: PostStatusFilter) => void
  setListSort: (value: ListSort) => void
  setToast: (value: WorkspaceToastState) => void
  shouldRenderMobileList: boolean
  toast: WorkspaceToastState
}

export const AdminPostsWorkspacePageView = (props: AdminPostsWorkspacePageViewProps) => {
  const {
    confirmState,
    handleConfirmAction,
    handleToastAction,
    initialProfileSnapshot,
    isListLoading,
    listError,
    listKw,
    listPage,
    listPageSize,
    listScope,
    listStatus,
    listSectionRef,
    listSort,
    listState,
    loadList,
    mutationPending,
    handleDeletePost,
    onHardDeletePost,
    onRestorePost,
    openWriteRoute,
    sessionMember,
    setConfirmState,
    setListKw,
    setListPage,
    setListStatus,
    setListSort,
    setToast,
    shouldRenderMobileList,
    toast,
  } = props

  return (
    <AdminShell currentSection="posts" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <Main>
        <HeroSection>
          <AdminWorkspaceHeroLayout>
            <PostsHeroCopy>
              <span>Content</span>
              <h1>글 관리</h1>
              <p>초안, 발행, 비공개, 삭제 상태를 같은 목록에서 관리합니다.</p>
            </PostsHeroCopy>
            <AdminWorkspaceHeroActions>
              <PrimaryCta type="button" onClick={() => void openWriteRoute()}>
                새 글 작성
              </PrimaryCta>
            </AdminWorkspaceHeroActions>
          </AdminWorkspaceHeroLayout>
        </HeroSection>

        <WorkspaceBody>
          <WorkspaceMain>
            <ListSection ref={listSectionRef}>
              <AdminPostsWorkspaceFilterToolbar
                listScope={listScope}
                listStatus={listStatus}
                listKw={listKw}
                listSort={listSort}
                onStatusChange={setListStatus}
                onKeywordChange={(value) => {
                  setListPage(DEFAULT_PAGE)
                  setListKw(value)
                }}
                onSortChange={setListSort}
              />

              <AdminPostsWorkspaceList
                listScope={listScope}
                listKw={listKw}
                listPage={listPage}
                listPageSize={listPageSize}
                listState={listState}
                isListLoading={isListLoading}
                listError={listError}
                shouldRenderMobileList={shouldRenderMobileList}
                onLoadList={() => void loadList()}
                onOpenWriteRoute={(query) => void openWriteRoute(query)}
                onPageChange={(page) => setListPage(String(page))}
                mutationPending={mutationPending}
                onDeletePost={(row) => void handleDeletePost(row)}
                onHardDeletePost={(row) => void onHardDeletePost(row)}
                onRestorePost={(row) => void onRestorePost(row)}
                onResetSearch={() => {
                  setListKw("")
                  setListPage(DEFAULT_PAGE)
                }}
              />
            </ListSection>
          </WorkspaceMain>
        </WorkspaceBody>

        <AdminPostsWorkspaceFeedbackLayer
          toast={toast}
          confirmState={confirmState}
          onToastAction={() => void handleToastAction()}
          onToastDismiss={() => setToast(null)}
          onConfirmCancel={() => setConfirmState(null)}
          onConfirmAction={() => void handleConfirmAction()}
        />
      </Main>
    </AdminShell>
  )
}
