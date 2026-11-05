import { act, createElement, Fragment, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { queryKey } from "../../src/constants/queryKey"
import {
  FloatingActionRail,
  MobileSummaryActions,
} from "../../src/routes/Detail/PostDetail/PostDetailActionSections"
import { PostHeaderEngagementSection } from "../../src/routes/Detail/PostDetail/PostHeader"
import {
  isPostLikedInStorage,
  LIKED_POSTS_STORAGE_KEY,
  readLikedPostIds,
  usePostDetailEngagementActions,
  writePostLikedInStorage,
} from "../../src/routes/Detail/PostDetail/usePostDetailEngagementActions"
import { createTheme } from "../../src/styles/theme"
import type { PostDetail } from "../../src/types"
import {
  createMinimalRootContainer,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const samplePost: PostDetail = {
  id: "42",
  date: { start_date: "2026-10-01" },
  slug: "post-42",
  title: "Interactive Like Test",
  content: "Body",
  createdAt: "2026-10-01T00:00:00Z",
  modifiedAt: "2026-10-01T00:00:00Z",
  createdTime: "2026-10-01T00:00:00Z",
  fullWidth: false,
  likesCount: 5,
  hitCount: 10,
  type: ["Post"],
  status: ["Public"],
}

test.describe("PostDetail interactive like controls and engagement hook lifecycle", () => {
  test("renders interactive like surfaces across PostHeader, FloatingActionRail, and MobileSummaryActions and caps localStorage at 200 post IDs", async () => {
    expect(LIKED_POSTS_STORAGE_KEY).toBe("aquila_blog_liked_posts_v1")

    const renderLikeSurfaces = (liked: boolean, likePending: boolean, likesCount: number) =>
      renderToStaticMarkup(
        materializePlaywrightJsx(
          createElement(ThemeProvider, {
            theme: lightTheme,
            children: createElement(
              Fragment,
              null,
              createElement(PostHeaderEngagementSection, {
                key: "header",
                publishedAt: "2026. 10. 01.",
                viewText: "10 VIEWS",
                showReadingTime: false,
                modifiedAt: "",
                resolvedLikesCount: likesCount,
                liked,
                likePending,
                onToggleLike: () => {},
                hideShareActionOnDesktop: false,
                hideActionButtonsOnMobile: false,
                onSharePost: () => {},
                shareFeedback: null,
                shareFeedbackMessage: "복사 완료",
              }),
              createElement(FloatingActionRail, {
                key: "floating",
                railRef: { current: null },
                innerRef: { current: null },
                active: false,
                showFloatingLike: true,
                likesCount,
                liked,
                likePending,
                onToggleLike: () => {},
                shareFeedback: null,
                onSharePost: () => {},
              }),
              createElement(MobileSummaryActions, {
                key: "mobile",
                likesCount,
                liked,
                likePending,
                onToggleLike: () => {},
                shareFeedback: null,
                onSharePost: () => {},
              })
            ),
          })
        ) as ReactElement
      )

    const unlikedHtml = renderLikeSurfaces(false, false, 5)
    expect(unlikedHtml).toContain('class="likeButton"')
    expect(unlikedHtml).toContain('aria-label="좋아요 (현재 5개)"')
    expect(unlikedHtml).toContain('aria-pressed="false"')
    expect(unlikedHtml).toContain('class="floatingActionButton floatingLikeBadge"')

    const likedPendingHtml = renderLikeSurfaces(true, true, 6)
    expect(likedPendingHtml).toContain('aria-label="좋아요 취소 (현재 6개)"')
    expect(likedPendingHtml).toContain('aria-pressed="true"')
    expect(likedPendingHtml).toContain('data-active="true"')
    expect(likedPendingHtml).toContain("disabled")

    await withWindowStorage(() => {
      for (let i = 1; i <= 205; i += 1) {
        writePostLikedInStorage(String(i), true)
      }
      const cappedIds = readLikedPostIds()
      expect(cappedIds).toHaveLength(200)
      expect(isPostLikedInStorage("205")).toBe(true)
      expect(isPostLikedInStorage("1")).toBe(false)

      writePostLikedInStorage("205", false)
      expect(isPostLikedInStorage("205")).toBe(false)
    })
  })

  test("usePostDetailEngagementActions handles PUT/DELETE like, concurrent POST /hit, A -> B and A -> B -> A navigation, and error rollback", async () => {
    await withWindowStorage(async () => {
      const queryClient = new QueryClient()
      queryClient.setQueryData(queryKey.post("42"), samplePost)

      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const previousFetch = globalThis.fetch

      const likeCalls: Array<{ url: string; method: string }> = []
      const pendingLikeResolvers: Array<(val: Response) => void> = []
      let interceptLikeQueue = false
      let shouldFailLikeRequest = false
      let nextHitCount = 11

      let hookState!: ReturnType<typeof usePostDetailEngagementActions>
      const probeProps: { data?: PostDetail; postId: string } = {
        data: samplePost,
        postId: "42",
      }

      const HookProbe = () => {
        hookState = usePostDetailEngagementActions({
          data: probeProps.data,
          postId: probeProps.postId,
        })
        return null
      }

      const renderProbe = async () => {
        await act(async () => {
          root.render(
            createElement(
              QueryClientProvider,
              { client: queryClient },
              createElement(HookProbe)
            )
          )
        })
      }

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? "GET"
        if (url.endsWith("/hit")) {
          return new Response(
            JSON.stringify({
              resultCode: "200-1",
              msg: "ok",
              data: { hitCount: nextHitCount },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        likeCalls.push({ url, method })
        if (shouldFailLikeRequest) {
          return new Response(
            JSON.stringify({ resultCode: "500-1", msg: "error", data: null }),
            { status: 500, headers: { "content-type": "application/json" } }
          )
        }
        if (interceptLikeQueue) {
          return await new Promise<Response>((resolve) => {
            pendingLikeResolvers.push(resolve)
          })
        }
        const liked = method === "PUT"
        const likesCount = liked ? 6 : 5
        return new Response(
          JSON.stringify({
            resultCode: "200-1",
            msg: "ok",
            data: { likesCount, liked },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      }) as typeof fetch

      try {
        await renderProbe()
        expect(hookState.likesCount).toBe(5)
        expect(hookState.liked).toBe(false)
        expect(hookState.likePending).toBe(false)
        expect(hookState.hitCount).toBe(11)

        await act(async () => {
          await hookState.handleToggleLike()
        })
        probeProps.data = queryClient.getQueryData<PostDetail>(queryKey.post("42")) ?? samplePost
        await renderProbe()
        expect(likeCalls).toEqual([
          { url: "http://localhost:8080/post/api/v1/posts/42/like", method: "PUT" },
        ])
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(6)
        expect(hookState.likePending).toBe(false)
        expect(isPostLikedInStorage("42")).toBe(true)
        expect(queryClient.getQueryData<PostDetail>(queryKey.post("42"))?.likesCount).toBe(6)

        await act(async () => {
          await hookState.handleToggleLike()
        })
        probeProps.data = queryClient.getQueryData<PostDetail>(queryKey.post("42")) ?? samplePost
        await renderProbe()
        expect(likeCalls).toEqual([
          { url: "http://localhost:8080/post/api/v1/posts/42/like", method: "PUT" },
          { url: "http://localhost:8080/post/api/v1/posts/42/like", method: "DELETE" },
        ])
        expect(hookState.liked).toBe(false)
        expect(hookState.likesCount).toBe(5)
        expect(hookState.likePending).toBe(false)
        expect(isPostLikedInStorage("42")).toBe(false)
        expect(queryClient.getQueryData<PostDetail>(queryKey.post("42"))?.likesCount).toBe(5)

        interceptLikeQueue = true
        let inFlightPut!: Promise<void>
        await act(async () => {
          inFlightPut = hookState.handleToggleLike()
        })
        probeProps.data = { ...samplePost, hitCount: 99, likesCount: 5 }
        await renderProbe()
        expect(hookState.likePending).toBe(true)
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(6)
        expect(hookState.hitCount).toBe(99)

        await act(async () => {
          await hookState.handleToggleLike()
        })
        expect(likeCalls).toHaveLength(3)

        await act(async () => {
          pendingLikeResolvers.shift()?.(
            new Response(
              JSON.stringify({
                resultCode: "200-1",
                msg: "ok",
                data: { likesCount: 6, liked: true },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          )
          await inFlightPut
        })
        probeProps.data = queryClient.getQueryData<PostDetail>(queryKey.post("42")) ?? samplePost
        await renderProbe()
        expect(hookState.likePending).toBe(false)
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(6)

        let staleDeleteOn42!: Promise<void>
        await act(async () => {
          staleDeleteOn42 = hookState.handleToggleLike()
        })
        expect(hookState.likePending).toBe(true)

        const post99: PostDetail = {
          ...samplePost,
          id: "99",
          slug: "post-99",
          likesCount: 20,
          hitCount: 3,
        }
        nextHitCount = 4
        queryClient.setQueryData(queryKey.post("99"), post99)
        probeProps.data = post99
        probeProps.postId = "99"
        await renderProbe()
        expect(hookState.likePending).toBe(false)
        expect(hookState.liked).toBe(false)
        expect(hookState.likesCount).toBe(20)
        expect(hookState.hitCount).toBe(4)

        probeProps.data = { ...samplePost, likesCount: 6, hitCount: 99 }
        probeProps.postId = "42"
        await renderProbe()
        expect(hookState.likePending).toBe(false)
        expect(hookState.liked).toBe(false)
        expect(hookState.likesCount).toBe(6)

        let secondPutOn42!: Promise<void>
        await act(async () => {
          secondPutOn42 = hookState.handleToggleLike()
        })
        expect(hookState.likePending).toBe(true)
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(7)

        await act(async () => {
          pendingLikeResolvers.shift()?.(
            new Response(
              JSON.stringify({
                resultCode: "200-1",
                msg: "ok",
                data: { likesCount: 5, liked: false },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          )
          await staleDeleteOn42
        })
        expect(hookState.likePending).toBe(true)
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(7)

        await act(async () => {
          pendingLikeResolvers.shift()?.(
            new Response(
              JSON.stringify({
                resultCode: "200-1",
                msg: "ok",
                data: { likesCount: 8, liked: true },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          )
          await secondPutOn42
        })
        expect(hookState.likePending).toBe(false)
        expect(hookState.liked).toBe(true)
        expect(hookState.likesCount).toBe(8)
        expect(isPostLikedInStorage("42")).toBe(true)
        expect(queryClient.getQueryData<PostDetail>(queryKey.post("42"))?.likesCount).toBe(8)

        interceptLikeQueue = false
        probeProps.data = post99
        probeProps.postId = "99"
        await renderProbe()

        shouldFailLikeRequest = true
        await act(async () => {
          await hookState.handleToggleLike()
        })
        expect(hookState.liked).toBe(false)
        expect(hookState.likesCount).toBe(20)
        expect(hookState.likePending).toBe(false)
        expect(isPostLikedInStorage("99")).toBe(false)
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = previousFetch
      }
    })
  })
})
