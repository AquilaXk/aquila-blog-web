import { expect, test } from "@playwright/test"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { FEED_EXPLORER_RESTORE_KEY_PREFIX } from "../src/libs/feed/feedRestoreCache"
import { registeredBrowserStorageKeys } from "../src/libs/privacy/browserStorageRegistry"
import { getLegalPolicyHistoryStaticProps } from "../src/libs/legal/serverPolicySource"
import { isLocalDraftExpired, LOCAL_DRAFT_MAX_AGE_MS } from "../src/routes/Admin/editorStudioStorageModel"

const srcRoot = path.resolve(__dirname, "../src")
const sourceConstantPattern =
  /const\s+([A-Za-z0-9_]*(?:KEY|PREFIX|COOKIE)[A-Za-z0-9_]*)\s*=\s*"([^"]+)"/g
const storageApiCallPattern =
  /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([A-Za-z0-9_]+)/g
const cookieApiCallPattern = /\b(?:setCookie|deleteCookie|getCookieValue)\(\s*([A-Za-z0-9_]+)/g
const registryOwnedSourceConstantNames = new Set(["LOCAL_DRAFT_CREATE_STORAGE_KEY"])

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(resolved)
    return /\.(ts|tsx)$/.test(entry.name) ? [resolved] : []
  })

const collectStorageConstants = () =>
  listSourceFiles(srcRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8")
    const hasBrowserStorageApi = /\b(?:localStorage|sessionStorage|setCookie|document\.cookie)/.test(source)
    const storageApiConstantNames = new Set(
      [
        ...Array.from(source.matchAll(storageApiCallPattern), (match) => match[1]),
        ...Array.from(source.matchAll(cookieApiCallPattern), (match) => match[1]),
      ],
    )

    return Array.from(source.matchAll(sourceConstantPattern), (match) => ({
      name: match[1],
      key: match[2],
      filePath: path.relative(srcRoot, filePath),
    })).filter(
      (sourceConstant) =>
        storageApiConstantNames.has(sourceConstant.name) ||
        registryOwnedSourceConstantNames.has(sourceConstant.name) ||
        (hasBrowserStorageApi && sourceConstant.name.includes("PREFIX") && !sourceConstant.key.startsWith("/")),
    )
  })

test("browser storage registry retains only current public and administrator keys", () => {
  expect(registeredBrowserStorageKeys).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ area: "cookie", key: "apiKey", purpose: "auth-session" }),
      expect.objectContaining({ area: "cookie", key: "accessToken", purpose: "auth-session" }),
      expect.objectContaining({ area: "cookie", key: "refreshToken", purpose: "auth-session" }),
      expect.objectContaining({ area: "cookie", key: "sessionKey", purpose: "auth-session" }),
      expect.objectContaining({ area: "localStorage", key: "auth.admin.savedEmail.v1" }),
      expect.objectContaining({ area: "localStorage", key: "admin.editor.localDraft.create.v3" }),
      expect.objectContaining({ area: "localStorage", key: "admin.editor.localDraft.post." }),
      expect.objectContaining({
        area: "sessionStorage",
        key: "auth:me:anon-probe-suppress-until:v1",
      }),
      expect.objectContaining({ area: "sessionStorage", key: "__aquila_client_runtime_recovery__" }),
      expect.objectContaining({ area: "sessionStorage", key: FEED_EXPLORER_RESTORE_KEY_PREFIX }),
    ])
  )

  const retiredKeys = [
    "signup_session",
    "admin_tools_mail_snapshot_v1",
    "auth.login.keepSignedIn",
    "auth.login.ipSecurityOn",
    "auth.admin.keepSignedIn.v1",
    "auth.signupMailCooldown.v1",
    "member.notification.lastEventId.v1",
    "member.notification.snapshot.v1",
    "privacy.optionalTrackingConsent.v1",
    "admin.editor.localDraft.v1",
    "admin.editor.localDraft.create.v2",
    "scheme",
  ]
  expect(registeredBrowserStorageKeys.map((entry) => entry.key)).not.toEqual(
    expect.arrayContaining(retiredKeys)
  )
})

test("browser storage registry covers source storage constants", () => {
  const registeredKeys = new Set(registeredBrowserStorageKeys.map((entry) => entry.key))
  const sourceConstants = collectStorageConstants()

  expect(sourceConstants).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "ADMIN_SAVED_EMAIL_STORAGE_KEY", key: "auth.admin.savedEmail.v1" }),
    expect.objectContaining({ name: "LOCAL_DRAFT_CREATE_STORAGE_KEY", key: "admin.editor.localDraft.create.v3" }),
    expect.objectContaining({
      name: "LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX",
      key: "admin.editor.localDraft.post.",
    }),
    expect.objectContaining({ name: "CLOUD_VIDEO_UPLOAD_SESSION_STORAGE_PREFIX", key: "aquila-cloud-video-upload-session" }),
  ]))
  expect(sourceConstants.map(({ name }) => name)).not.toEqual(
    expect.arrayContaining(["LOCAL_DRAFT_V1_STORAGE_KEY", "LOCAL_DRAFT_STORAGE_KEY"]),
  )
  expect(readFileSync(path.join(srcRoot, "routes/Admin/editorStudioStorageModel.ts"), "utf8")).not.toContain(
    "migrateLocalDraftV1Once",
  )

  for (const sourceConstant of sourceConstants) {
    expect(
      registeredKeys.has(sourceConstant.key),
      `${sourceConstant.name}=${sourceConstant.key} in ${sourceConstant.filePath} must be registered`,
    ).toBe(true)
  }

  expect(registeredKeys.has("scheme"), "light-only runtime must not retain a theme cookie").toBe(false)
})

test("browser storage registry records retention and deletion metadata for every entry", () => {
  for (const entry of registeredBrowserStorageKeys) {
    expect(entry.key).toBeTruthy()
    expect(entry.purpose).toBeTruthy()
    expect(typeof entry.required).toBe("boolean")
    expect(entry.retention).toBeTruthy()
    expect(entry.deletion).toBeTruthy()
    expect(entry.stores).toBeTruthy()
  }
})

test("legal history lists same-day cookie policies newest version first", () => {
  const { props } = getLegalPolicyHistoryStaticProps()
  const allCookieVersions = props.policies
    .filter((policy) => policy.kind === "cookies")
    .map((policy) => policy.version)
  const cookieVersions = props.policies
    .filter((policy) => policy.kind === "cookies" && policy.effectiveAt.startsWith("2026-06-22"))
    .map((policy) => policy.version)

  expect(allCookieVersions).toEqual(expect.arrayContaining(["1.0.0", "1.0.1", "1.0.2"]))
  expect(cookieVersions.indexOf("1.0.2")).toBeGreaterThanOrEqual(0)
  expect(cookieVersions.indexOf("1.0.1")).toBeGreaterThanOrEqual(0)
  expect(cookieVersions.indexOf("1.0.2")).toBeLessThan(cookieVersions.indexOf("1.0.1"))
})

test("local draft expiry rejects malformed, future, and seven-day-old timestamps", () => {
  const nowMs = Date.parse("2026-06-22T12:00:00.000Z")

  expect(isLocalDraftExpired("not-a-date", nowMs)).toBe(true)
  expect(isLocalDraftExpired(new Date(nowMs + 1).toISOString(), nowMs)).toBe(true)
  expect(isLocalDraftExpired(new Date(nowMs - LOCAL_DRAFT_MAX_AGE_MS).toISOString(), nowMs)).toBe(true)
  expect(isLocalDraftExpired(new Date(nowMs - LOCAL_DRAFT_MAX_AGE_MS + 1).toISOString(), nowMs)).toBe(false)
})
