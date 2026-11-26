import type { Page, Route } from "./helpers/authoringPlaywright"
import { expect, test } from "./helpers/authoringPlaywright"

const ADMIN_MEMBER = {
  id: 1,
  username: "qa-admin",
  nickname: "QA Admin",
  isAdmin: true,
  blogTitle: "AquilaLog",
}

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAp6pW2kAAAAASUVORK5CYII=",
  "base64"
)

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

const setupEditorCloudPickerMocks = async (
  page: Page,
  options: { failInsert?: boolean } = {}
) => {
  const promotedFileIds: string[] = []
  const pickerPhotos = [
    {
      id: 501,
      ownerMemberId: 1,
      originalFilename: "system-topology.svg",
      contentType: "image/svg+xml",
      byteSize: 512,
      mediaKind: "PHOTO",
      folderPath: "diagrams",
      createdAt: "2026-06-12T08:00:00Z",
      modifiedAt: "2026-06-12T08:00:00Z",
    },
    {
      id: 502,
      ownerMemberId: 1,
      originalFilename: "rack-blueprint.png",
      contentType: "image/png",
      byteSize: 1_842_336,
      mediaKind: "PHOTO",
      folderPath: "photos",
      createdAt: "2026-06-12T09:00:00Z",
      modifiedAt: "2026-06-12T09:00:00Z",
    },
    {
      id: 503,
      ownerMemberId: 1,
      originalFilename: "5k-raw-panorama.png",
      contentType: "image/png",
      byteSize: 14_680_064,
      mediaKind: "PHOTO",
      folderPath: "photos",
      createdAt: "2026-06-12T10:00:00Z",
      modifiedAt: "2026-06-12T10:00:00Z",
    },
  ]

  await page.route("**/member/api/v1/auth/me", (route) => fulfillJson(route, ADMIN_MEMBER))
  await page.route("**/member/api/v1/members/adminProfile", (route) =>
    fulfillJson(route, {
      username: "qa-admin",
      name: "QA Admin",
      nickname: "QA Admin",
      profileImageUrl: "",
      profileRole: "Admin",
      profileBio: "",
    })
  )
  await page.route("**/post/api/v1/**", (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/posts/tags")) return fulfillJson(route, [])
    if (pathname.endsWith("/posts/temp")) {
      return fulfillJson(route, {
        resultCode: "200-1",
        msg: "temp draft",
        data: {
          id: 990,
          title: "임시글",
          content: "",
          summary: "",
          summarySource: "NONE",
          published: false,
          listed: false,
          tempDraft: true,
        },
      })
    }
    return fulfillJson(route, {
      posts: [],
      items: [],
      categories: ["Platform"],
      tags: [],
      totalCount: 0,
    })
  })
  await page.route("**/system/api/v1/adm/cloud/files**", (route) =>
    fulfillJson(route, { files: pickerPhotos })
  )
  await page.route("**/system/api/v1/adm/cloud/files/*/thumbnail**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  )
  await page.route("**/system/api/v1/adm/cloud/files/*/promote-post-asset", async (route) => {
    const id =
      new URL(route.request().url()).pathname.match(/\/files\/(\d+)\/promote-post-asset$/)?.[1] ?? ""
    promotedFileIds.push(id)
    if (options.failInsert) {
      await fulfillJson(
        route,
        { resultCode: "400-1", msg: "게시글 삽입은 JPEG·PNG·GIF·WebP 이미지만 지원합니다." },
        400
      )
      return
    }
    await fulfillJson(
      route,
      {
        resultCode: "201-1",
        msg: "게시글에 삽입할 이미지가 준비되었습니다.",
        data: {
          fileId: Number(id),
          key: `post-images/${id}.webp`,
          url: `/post/api/v1/images/${id}.webp`,
          markdown: `![rack-blueprint.png](/post/api/v1/images/${id}.webp)`,
        },
      },
      201
    )
  })

  return { promotedFileIds }
}

test.describe("에디터 클라우드 사진 삽입", () => {
  test("자연스러운 한국어 문구로 필터링·폴더 전환·본문 삽입과 오류 안내가 동작한다", async ({
    page,
  }) => {
    const mocks = await setupEditorCloudPickerMocks(page)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => undefined },
      })
    })

    await page.goto("/admin/editor/new?source=local-draft")
    const toggleBtn = page.getByRole("button", { name: "메타 패널 토글" })
    await expect(toggleBtn).toBeVisible()
    if ((await toggleBtn.getAttribute("aria-pressed")) !== "true") {
      await toggleBtn.click()
    }

    const pickerSection = page.getByRole("region", { name: "클라우드 사진 삽입" })
    await expect(pickerSection).toBeVisible()
    await expect(pickerSection.getByText(/승격|피커|래스터/)).toHaveCount(0)

    await pickerSection.getByRole("button", { name: "사진 불러오기" }).click()
    await expect(pickerSection.getByRole("button", { name: "닫기" })).toBeVisible()

    const filterGroup = pickerSection.getByRole("group", { name: "클라우드 사진 삽입" })
    await expect(filterGroup.getByRole("button", { name: "삽입 가능한 사진만" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(pickerSection.getByText("rack-blueprint.png")).toBeVisible()
    await expect(pickerSection.getByText("system-topology.svg")).toHaveCount(0)

    await filterGroup.getByRole("button", { name: "전체", exact: true }).click()
    await expect(pickerSection.getByText("system-topology.svg")).toBeVisible()
    await expect(pickerSection.getByText("SVG는 본문에 삽입할 수 없습니다")).toBeVisible()
    await expect(pickerSection.getByText("8MB 초과 (삽입 불가)")).toBeVisible()
    await expect(pickerSection.getByText(/승격|피커|래스터/)).toHaveCount(0)

    const folderGroup = pickerSection.getByRole("group", { name: "폴더 경로 탐색" })
    await expect(folderGroup.getByRole("button", { name: "전체 폴더" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await folderGroup.getByRole("button", { name: "/diagrams" }).click()
    await expect(pickerSection.getByText("rack-blueprint.png")).toHaveCount(0)
    await folderGroup.getByRole("button", { name: "전체 폴더" }).click()
    await expect(pickerSection.getByText("rack-blueprint.png")).toBeVisible()

    const rackCard = pickerSection.locator("li", { hasText: "rack-blueprint.png" })
    await rackCard.getByRole("button", { name: "본문에 삽입" }).click()
    await expect.poll(() => mocks.promotedFileIds).toEqual(["502"])
    await expect(rackCard.getByRole("button", { name: "삽입됨" })).toBeVisible()
    await expect(
      page.locator('.cm-content img[alt="rack-blueprint.png"]')
    ).toHaveAttribute("src", "/post/api/v1/images/502.webp")
    await page.getByRole("button", { name: "소스 모드" }).click()
    await expect(page.locator(".cm-content")).toContainText(
      "![rack-blueprint.png](/post/api/v1/images/502.webp)"
    )
  })

  test("영문 모드와 삽입 실패 응답에서도 내부 개발 용어를 노출하지 않는다", async ({ page }) => {
    await setupEditorCloudPickerMocks(page, { failInsert: true })
    await page.addInitScript(() => {
      window.localStorage.setItem("aquila_blog_lang", "en")
    })

    await page.goto("/admin/editor/new?source=local-draft")
    const toggleBtn = page.getByRole("button", { name: "Toggle settings panel" })
    await expect(toggleBtn).toBeVisible()
    if ((await toggleBtn.getAttribute("aria-pressed")) !== "true") {
      await toggleBtn.click()
    }

    const pickerSection = page.getByRole("region", { name: "Insert Cloud Photo" })
    await expect(pickerSection).toBeVisible()
    await pickerSection.getByRole("button", { name: "Choose photo" }).click()
    await expect(pickerSection.getByRole("button", { name: "Close" })).toBeVisible()

    const filterGroup = pickerSection.getByRole("group", { name: "Insert Cloud Photo" })
    await expect(filterGroup.getByRole("button", { name: "Insertable only" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await filterGroup.getByRole("button", { name: "All", exact: true }).click()
    await expect(pickerSection.getByText("SVG cannot be inserted into posts")).toBeVisible()
    await expect(pickerSection.getByText("Exceeds 8MB limit")).toBeVisible()
    await expect(pickerSection.getByText(/promot|raster/i)).toHaveCount(0)

    await pickerSection
      .locator("li", { hasText: "rack-blueprint.png" })
      .getByRole("button", { name: "Insert image" })
      .click()
    await expect(pickerSection.getByRole("alert")).toContainText(
      "게시글 삽입은 JPEG·PNG·GIF·WebP 이미지만 지원합니다."
    )
  })
})
