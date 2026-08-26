import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { ACTIVE_LEGAL_DOCUMENTS } from "src/apis/backend/legal"
import type { DashboardSnapshotPayload } from "src/routes/Admin/AdminDashboardWorkspaceModel"
import type { TaskQueueDiagnostics } from "src/routes/Admin/AdminToolsWorkspacePageState"
import { expectNoHorizontalOverflow } from "./helpers/adaptivityFixtures"
import {
  ADMIN_MEMBER_FIXTURE,
  mockAvatarAsset,
} from "./helpers/mobileLayoutFixtures"
import { mockPublicAdminProfile } from "./helpers/smokeFixtures"

const RAW_CANARY = "task-id-raw-canary"
const DLQ_REGION_NAME = "DLQ replay"
const TASK_TYPE = "MAIL_SIGNUP"
const ADMIN_TASK_DLQ_REPLAY_ENDPOINT =
  "/system/api/v1/adm/operations/task-dlq-replay"
const UNCERTAIN_GATEWAY_STATUS = 504

type ReplayCounters = {
  post: number
  get: number
  operationId: string
  requests: Record<string, unknown>[]
}

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

const systemHealth = {
  status: "UP",
  details: { db: { status: "UP" }, queue: { status: "UP" } },
}

const dashboardSnapshot: DashboardSnapshotPayload = {
  generatedAt: "2026-08-26T00:00:00Z",
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

const taskQueueDiagnostics: TaskQueueDiagnostics = {
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
  taskTypes: [
    {
      taskType: TASK_TYPE,
      pendingCount: 0,
      readyPendingCount: 0,
      delayedPendingCount: 0,
      processingCount: 0,
      backlogCount: 0,
      queueLagSeconds: null,
      failedCount: 0,
      staleProcessingCount: 0,
      label: "Signup mail",
      oldestReadyPendingAt: null,
      oldestReadyPendingAgeSeconds: null,
      latestFailureAt: null,
      latestFailureMessage: null,
      retryPolicy: {
        label: "bounded retry",
        maxRetries: 3,
        baseDelaySeconds: 30,
        backoffMultiplier: 2,
        maxDelaySeconds: 300,
      },
    },
  ],
  recentFailures: [],
  staleProcessingSamples: [],
}

const installAdminToolsMocks = async (page: Page, counters: ReplayCounters) => {
  await mockAvatarAsset(page)
  await mockPublicAdminProfile(page)

  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(adminMember),
    })
  })
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ legalReconsent: adminMember.legalReconsent }),
    })
  })
  await page.route("**/system/api/v1/adm/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        member: adminMember,
        health: systemHealth,
        dashboard: dashboardSnapshot,
      }),
    })
  })
  await page.route("**/system/api/v1/adm/health**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(systemHealth),
    })
  })
  await page.route("**/system/api/v1/adm/dashboard-snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboardSnapshot),
    })
  })
  await page.route("**/system/api/v1/adm/tasks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(taskQueueDiagnostics),
    })
  })
  await page.route(`**${ADMIN_TASK_DLQ_REPLAY_ENDPOINT}`, async (route) => {
    expect(route.request().method()).toBe("POST")
    counters.post += 1
    const request = route.request().postDataJSON() as Record<string, unknown>
    counters.requests.push(request)
    expect(request).toMatchObject({
      reason: "Recover this bounded queue batch.",
      taskType: TASK_TYPE,
      limit: 5,
      resetRetryCount: false,
    })
    expect(request.operationId).toMatch(/^[0-9a-f-]{36}$/i)
    if (!counters.operationId)
      counters.operationId = String(request.operationId)
    expect(request.operationId).toBe(counters.operationId)
    if (counters.post === 1) {
      await route.fulfill({
        status: UNCERTAIN_GATEWAY_STATUS,
        contentType: "application/json",
        body: JSON.stringify({
          resultCode: "504-00",
          msg: "The gateway timed out before the operation result was known.",
        }),
      })
      return
    }
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "202-40",
        msg: "accepted",
        data: {
          operationId: counters.operationId,
          action: "TASK_DLQ_REPLAY",
          status: "ACCEPTED",
          selectedCount: 0,
          replayedCount: 0,
          quarantinedCount: 0,
        },
      }),
    })
  })
  await page.route(
    /\/system\/api\/v1\/adm\/operations\/[0-9a-f-]{36}(?:\?.*)?$/i,
    async (route) => {
      expect(route.request().method()).toBe("GET")
      expect(counters.operationId).not.toBe("")
      expect(route.request().url()).toContain(
        `/operations/${counters.operationId}`
      )
      counters.get += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          resultCode: "200-40",
          msg: "ok",
          data: {
            operationId: counters.operationId,
            action: "TASK_DLQ_REPLAY",
            status: "PARTIAL",
            resultCode: "TASKS_PARTIALLY_REPLAYED",
            selectedCount: 5,
            replayedCount: 3,
            quarantinedCount: 2,
            actorId: 91,
            sessionRowId: 72,
            target: RAW_CANARY,
            reason: "reason-raw-canary",
          },
        }),
      })
    }
  )
}

test("admin DLQ replay keeps a durable accepted-to-terminal receipt without exposing private task data", async ({
  page,
}) => {
  const counters: ReplayCounters = {
    post: 0,
    get: 0,
    operationId: "",
    requests: [],
  }
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("response", (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await installAdminToolsMocks(page, counters)
  await page.goto("/admin/tools")
  const queueTab = page.getByRole("tab", { name: "작업 큐 진단" })
  const applicationError = page.getByRole("heading", {
    name: "문제가 발생했습니다",
  })
  await Promise.race([
    expect(queueTab).toHaveAttribute("aria-selected", "false"),
    new Promise<never>((_, reject) => {
      if (pageErrors[0]) reject(new Error(pageErrors[0]))
      else page.once("pageerror", reject)
    }),
  ])
  const clientExceptions = consoleErrors.filter((message) =>
    /TypeError|ReferenceError|client-side exception/i.test(message)
  )
  expect({
    pageErrors,
    clientExceptions,
    applicationError: await applicationError.count(),
  }).toEqual({
    pageErrors: [],
    clientExceptions: [],
    applicationError: 0,
  })
  await Promise.race([
    page.getByRole("tab", { name: "작업 큐 진단" }).click(),
    new Promise<never>((_, reject) => page.once("pageerror", reject)),
    applicationError.waitFor({ state: "visible" }).then(async () => {
      const reports = await page.evaluate(
        () => window.__AQUILA_CLIENT_ERROR_REPORTS__ || []
      )
      const details = [
        ...failedResponses,
        ...pageErrors,
        ...consoleErrors,
        JSON.stringify(reports),
      ].join("\n")
      throw new Error(
        details || "The admin tools page entered the client-side error state."
      )
    }),
  ])

  const region = page.getByRole("region", { name: DLQ_REGION_NAME })
  const reason = region.getByLabel("Reason")
  const confirmation = region.getByRole("checkbox", {
    name: "I confirm this DLQ replay",
  })
  const submit = region.getByRole("button", { name: "Request DLQ replay" })

  await expect(region).toBeVisible()
  await expect(submit).toBeDisabled()
  await reason.fill("Recover this bounded queue batch.")
  await region.getByLabel("Task type").selectOption(TASK_TYPE)
  await region.getByLabel("Replay limit").fill("5")
  await region.getByLabel("Reset retry count").uncheck()
  await confirmation.check()
  await expect(submit).toBeEnabled()
  const firstPostTimedOut = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        ADMIN_TASK_DLQ_REPLAY_ENDPOINT
      ) &&
      response.status() === UNCERTAIN_GATEWAY_STATUS
  )
  await submit.dblclick()
  await firstPostTimedOut

  await expect.poll(() => counters.post).toBe(1)
  await expect.poll(() => counters.get).toBe(0)
  const retrySameRequest = region.getByRole("button", {
    name: "Retry same request",
  })
  await expect(retrySameRequest).toBeVisible()
  await retrySameRequest.click()
  await expect.poll(() => counters.post).toBe(2)
  expect(counters.requests[1]).toEqual(counters.requests[0])
  await expect(region.getByText("Accepted and pending")).toBeVisible()
  await expect(region.getByText("Succeeded")).toHaveCount(0)

  await page.reload()
  await page.getByRole("tab", { name: "작업 큐 진단" }).click()
  await expect(region.getByText("Partially completed")).toBeVisible()
  await expect.poll(() => counters.post).toBe(2)
  await expect.poll(() => counters.get).toBe(1)
  await expect(region.getByText("TASKS_PARTIALLY_REPLAYED")).toBeVisible()
  await expect(region.getByText("Selected 5")).toBeVisible()
  await expect(region.getByText("Replayed 3")).toBeVisible()
  await expect(region.getByText("Quarantined 2")).toBeVisible()

  const renderedText = await region.innerText()
  expect(renderedText).not.toContain(RAW_CANARY)
  expect(renderedText).not.toContain("reason-raw-canary")
  expect(renderedText).not.toContain("91")
  expect(renderedText).not.toContain("72")
  expect(renderedText).not.toContain(counters.operationId)

  const axeResults = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="DLQ replay"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
  expect(
    axeResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact || "")
    )
  ).toEqual([])

  await page.setViewportSize({ width: 393, height: 852 })
  await expectNoHorizontalOverflow(page)
})
