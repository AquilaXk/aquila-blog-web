import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { ACTIVE_LEGAL_DOCUMENTS } from "src/apis/backend/legal"
import { ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY } from "src/libs/privacy/browserStorageRegistry"
import { expectNoHorizontalOverflow } from "./helpers/adaptivityFixtures"
import {
  ADMIN_MEMBER_FIXTURE,
  mockAvatarAsset,
} from "./helpers/mobileLayoutFixtures"
import { mockPublicAdminProfile } from "./helpers/smokeFixtures"

const PIPELINE_ENDPOINT = "/system/api/v1/adm/search/pipeline/force-control"
const MIRROR_ENDPOINT = "/system/api/v1/adm/search-engine/mirror/force-disable"
const RAW_CANARY = "search-control-raw-canary"

const adminMember = {
  ...ADMIN_MEMBER_FIXTURE,
  legalReconsent: {
    status: "CURRENT",
    required: false,
    termsVersion: ACTIVE_LEGAL_DOCUMENTS.terms.version,
    termsContentSha256: ACTIVE_LEGAL_DOCUMENTS.terms.contentSha256,
    privacyVersion: ACTIVE_LEGAL_DOCUMENTS.privacy.version,
    privacyContentSha256: ACTIVE_LEGAL_DOCUMENTS.privacy.contentSha256,
  },
}

const dashboard = {
  generatedAt: "2026-08-27T00:00:00Z",
  taskQueue: {
    pendingCount: 0,
    readyPendingCount: 0,
    processingCount: 0,
    failedCount: 0,
    staleProcessingCount: 0,
    oldestReadyPendingAgeSeconds: null,
    latestFailureAt: null,
    latestFailureMessage: null,
  },
  signupMail: {
    status: "READY",
    queueLagSeconds: null,
    latestFailureAt: null,
    latestFailureMessage: null,
  },
  authSecurity: {
    recentEventCount: 0,
    blockedEventCount: 0,
    latestEventAt: null,
    latestBlockedAt: null,
  },
  storageCleanup: {
    eligibleForPurgeCount: 0,
    blockedBySafetyThreshold: false,
    oldestEligiblePurgeAfter: null,
  },
}

const tasks = {
  pendingCount: 0,
  readyPendingCount: 0,
  delayedPendingCount: 0,
  processingCount: 0,
  completedCount: 0,
  failedCount: 0,
  staleProcessingCount: 0,
  oldestReadyPendingAt: null,
  oldestProcessingAt: null,
  oldestReadyPendingAgeSeconds: null,
  oldestProcessingAgeSeconds: null,
  processingTimeoutSeconds: 60,
  taskTypes: [],
  recentFailures: [],
  staleProcessingSamples: [],
}

const setupAdmin = async (page: Page) => {
  await mockAvatarAsset(page)
  await mockPublicAdminProfile(page)
  const health = {
    status: "UP",
    details: { db: { status: "UP" }, queue: { status: "UP" } },
  }
  for (const [path, body] of [
    ["**/member/api/v1/auth/me", adminMember],
    [
      "**/member/api/v1/auth/session",
      { legalReconsent: adminMember.legalReconsent },
    ],
    [
      "**/system/api/v1/adm/bootstrap",
      { member: adminMember, health, dashboard },
    ],
    ["**/system/api/v1/adm/health**", health],
    ["**/system/api/v1/adm/dashboard-snapshot", dashboard],
    ["**/system/api/v1/adm/tasks", tasks],
  ] as const) {
    await page.route(path, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    )
  }
}

const openControls = async (page: Page) => {
  await page.goto("/admin/tools")
  await page.getByRole("tab", { name: "작업 큐 진단" }).click()
  return page.getByRole("region", { name: "Search runtime controls" })
}

test("pipeline keeps one request through timeout, reload, and verified status", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = []
  let statusReads = 0
  await setupAdmin(page)
  await page.route(`**${PIPELINE_ENDPOINT}`, async (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>
    requests.push(request)
    expect(route.request().method()).toBe("POST")
    if (requests.length === 1) return route.fulfill({ status: 504, body: "{}" })
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          operationId: request.operationId,
          action: "SEARCH_PIPELINE_FORCE_CONTROL",
          status: "ACCEPTED",
          controlKey: "PIPELINE_FORCE_CONTROL",
          controlValue: "ENABLED",
          controlVersion: null,
        },
      }),
    })
  })
  await page.route(
    /\/system\/api\/v1\/adm\/operations\/[0-9a-f-]{36}$/i,
    async (route) => {
      const id = route.request().url().split("/").pop()
      if (!requests[0] || id !== requests[0].operationId)
        throw new Error("missing saved pipeline request")
      statusReads += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            operationId: id,
            action: "SEARCH_PIPELINE_FORCE_CONTROL",
            status: "SUCCEEDED",
            resultCode: "SEARCH_PIPELINE_FORCE_CONTROL_UPDATED",
            controlKey: "PIPELINE_FORCE_CONTROL",
            controlValue: "ENABLED",
            controlVersion: 1,
            actorId: 9,
            sessionRowId: 8,
            target: RAW_CANARY,
            reason: RAW_CANARY,
          },
        }),
      })
    }
  )
  const region = await openControls(page)
  const group = region.getByRole("group", {
    name: "Search pipeline force control",
  })
  await group
    .getByLabel("Search pipeline force control reason")
    .fill("repair pipeline")
  await group.getByRole("checkbox").check()
  await group
    .getByRole("button", { name: "Request Search pipeline force control" })
    .dblclick()
  await expect.poll(() => requests.length).toBe(1)
  await expect(group.getByRole("button", { name: "New command" })).toHaveCount(
    0
  )
  await group.getByRole("button", { name: "Retry same request" }).click()
  await expect.poll(() => requests.length).toBe(2)
  expect(requests[1]).toEqual(requests[0])
  await expect(group.getByText("Accepted and pending")).toBeVisible()
  await expect(group.getByText("version")).toHaveCount(0)
  await page.reload()
  await page.getByRole("tab", { name: "작업 큐 진단" }).click()
  await expect.poll(() => statusReads).toBe(1)
  await expect(region.getByText("Succeeded")).toBeVisible()
  await expect(region.getByText("version 1")).toBeVisible()
  await expect(region).not.toContainText(RAW_CANARY)
  expect(
    await page.evaluate(
      (key) => !!sessionStorage.getItem(key),
      ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY
    )
  ).toBe(true)
  const axe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Search runtime controls"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || "")
    )
  ).toEqual([])
  await page.setViewportSize({ width: 393, height: 852 })
  await expectNoHorizontalOverflow(page)
})

test("mirror labels map to exact success and conflict requests", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = []
  await setupAdmin(page)
  await page.route(`**${MIRROR_ENDPOINT}`, async (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>
    requests.push(request)
    if (requests.length === 1) {
      expect(request).toMatchObject({ forceDisabled: false })
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            operationId: request.operationId,
            action: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE",
            status: "ACCEPTED",
            resultCode: null,
            controlKey: "MIRROR_FORCE_DISABLE",
            controlValue: "ENABLED",
            controlVersion: null,
          },
        }),
      })
      return
    }
    expect(request).toMatchObject({ forceDisabled: true })
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "409-40", msg: "conflict" }),
    })
  })
  await page.route(
    /\/system\/api\/v1\/adm\/operations\/[0-9a-f-]{36}$/i,
    async (route) => {
      const operationId = route.request().url().split("/").pop()
      if (!requests[0] || operationId !== requests[0].operationId)
        throw new Error("missing saved mirror request")
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            operationId,
            action: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE",
            status: "SUCCEEDED",
            resultCode: "SEARCH_ENGINE_MIRROR_FORCE_DISABLE_UPDATED",
            controlKey: "MIRROR_FORCE_DISABLE",
            controlValue: "ENABLED",
            controlVersion: 2,
          },
        }),
      })
    }
  )

  const region = await openControls(page)
  const group = region.getByRole("group", {
    name: "Search mirror force disable",
  })
  const desiredState = group.getByLabel("Desired state")
  const reason = group.getByLabel("Search mirror force disable reason")
  const confirmation = group.getByRole("checkbox")
  const requestButton = group.getByRole("button", {
    name: "Request Search mirror force disable",
  })

  await desiredState.selectOption({ label: "Allow mirror" })
  await expect(desiredState).toHaveValue("false")
  await reason.fill("allow mirror")
  await expect(confirmation).not.toBeChecked()
  await confirmation.check()
  await requestButton.click()
  await expect.poll(() => requests.length).toBe(1)
  await expect(group.getByText("Accepted and pending")).toBeVisible()
  await group.getByRole("button", { name: "Check status" }).click()
  await expect(group.getByText("Succeeded")).toBeVisible()
  await expect(group.getByText("version 2")).toBeVisible()
  await group.getByRole("button", { name: "New command" }).click()
  await expect(confirmation).not.toBeChecked()

  await desiredState.selectOption({ label: "Force mirror disabled" })
  await expect(desiredState).toHaveValue("true")
  await reason.fill("conflict")
  await confirmation.check()
  await requestButton.click()
  await expect.poll(() => requests.length).toBe(2)
  await expect(region.getByRole("alert")).toContainText(
    "operation ID conflicts"
  )
  await expect(group.getByRole("button", { name: "New command" })).toBeVisible()
  await expect(
    group.getByRole("button", { name: "Retry same request" })
  ).toHaveCount(0)
  await group.getByRole("button", { name: "New command" }).click()
  await expect(reason).toBeEnabled()
  await expect(confirmation).not.toBeChecked()
})
