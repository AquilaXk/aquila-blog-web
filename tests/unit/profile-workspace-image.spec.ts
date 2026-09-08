import { expect, test } from "@playwright/test"
import {
  parseProfileImageUploadResponse,
  reconcileProfileWorkspaceDraft,
  saveProfileWorkspaceImage,
} from "../../src/libs/profileWorkspaceImage"
import type { ProfileWorkspaceContent, ProfileWorkspaceResponse } from "../../src/libs/profileWorkspace"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"

const draft: ProfileWorkspaceContent = {
  profileImageUrl: "/before.png", profileRole: "Writer", profileBio: "Bio", aboutHeadline: "Headline",
  aboutRole: "Role", aboutBio: "About", aboutSections: [{ id: "notes", title: "Notes", items: ["one"], dividerBefore: false }],
  aboutProjectSectionTitle: "Projects", aboutProjects: [{ id: "project", name: "Aquila", summary: "Summary", role: "Owner", href: "https://example.com", linkLabel: "Open" }],
  blogTitle: "Blog", homeIntroTitle: "Intro", homeIntroDescription: "Description", blogDesign: "legacy", legacyBlogScheme: "light",
  serviceLinks: [{ icon: "service", label: "GitHub", href: "https://github.com" }], contactLinks: [],
}

const workspace = (nextDraft: ProfileWorkspaceContent): ProfileWorkspaceResponse => ({
  draft: nextDraft, published: draft, lastDraftSavedAt: null, lastPublishedAt: null, dirtyFromPublished: true,
})

test("image save sends the full latest canonical draft in one PUT", async () => {
  registerServerApiFetchMetrics()
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init })
    return new Response(JSON.stringify(workspace({ ...draft, profileImageUrl: "/uploaded.png" })), {
      status: 200, headers: { "content-type": "application/json" },
    })
  }) as typeof fetch
  try {
    await expect(saveProfileWorkspaceImage(7, draft, "/uploaded.png")).resolves.toEqual(
      workspace({ ...draft, profileImageUrl: "/uploaded.png" })
    )
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).pathname).toBe("/member/api/v1/adm/members/7/profileWorkspace/draft")
    expect(requests[0].init?.method).toBe("PUT")
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ ...draft, profileImageUrl: "/uploaded.png" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

for (const response of [
  new Response("null", { status: 200, headers: { "content-type": "application/json" } }),
  new Response(JSON.stringify({ msg: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } }),
]) {
  test(`image save rejects a non-canonical response (${response.status})`, async () => {
    registerServerApiFetchMetrics()
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => response) as typeof fetch
    try {
      if (response.status === 200) {
        await expect(saveProfileWorkspaceImage(7, draft, "/uploaded.png")).rejects.toThrow("canonical")
      } else {
        await expect(saveProfileWorkspaceImage(7, draft, "/uploaded.png")).rejects.toMatchObject({ status: 503 })
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}

test("malformed upload data has no accepted image URL", () => {
  expect(() => parseProfileImageUploadResponse({ profileImageUrl: "" })).toThrow("profileImageUrl")
  expect(() => parseProfileImageUploadResponse({ profileImageUrl: 7 })).toThrow("profileImageUrl")
  expect(() => parseProfileImageUploadResponse({})).toThrow("profileImageUrl")
})

test("remote reconciliation preserves newer edited fields", () => {
  const previousRemote = draft
  const current = { ...draft, profileRole: "Edited locally" }
  const nextRemote = { ...draft, profileImageUrl: "/server.png", profileRole: "Older remote" }
  expect(reconcileProfileWorkspaceDraft(current, previousRemote, nextRemote)).toEqual(current)
  expect(reconcileProfileWorkspaceDraft(previousRemote, previousRemote, nextRemote)).toEqual(nextRemote)
})
