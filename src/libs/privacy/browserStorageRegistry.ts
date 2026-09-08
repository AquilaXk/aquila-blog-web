import { FEED_EXPLORER_RESTORE_KEY_PREFIX } from "src/libs/feed/feedRestoreCache"

export const ADMIN_TASK_DLQ_REPLAY_SESSION_KEY = "admin.tools.taskDlqReplay.v1"
export const ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY =
  "admin.tools.searchRuntimeControl.v1"

export type BrowserStorageArea = "cookie" | "localStorage" | "sessionStorage"

export type BrowserStorageRegistryEntry = {
  area: BrowserStorageArea
  key: string
  purpose: string
  required: boolean
  retention: string
  deletion: string
  stores: string
}

type AdminAuthCookieEntry = Pick<
  BrowserStorageRegistryEntry,
  "key" | "retention" | "deletion" | "stores"
>

const adminAuthCookieEntry = (
  entry: AdminAuthCookieEntry,
): BrowserStorageRegistryEntry => ({
  area: "cookie",
  purpose: "auth-session",
  required: true,
  ...entry,
})

export const registeredBrowserStorageKeys: BrowserStorageRegistryEntry[] = [
  adminAuthCookieEntry({
    key: "apiKey",
    retention: "session or 30 days when keep-signed-in is enabled",
    deletion: "logout, session revocation, or browser cookie deletion",
    stores: "administrator API key token value",
  }),
  adminAuthCookieEntry({
    key: "accessToken",
    retention: "session or access-token TTL when keep-signed-in is enabled",
    deletion: "logout, refresh rotation, session revocation, or browser cookie deletion",
    stores: "JWT access token",
  }),
  adminAuthCookieEntry({
    key: "refreshToken",
    retention: "session or 30 days when keep-signed-in is enabled",
    deletion: "logout, refresh rotation, session revocation, or browser cookie deletion",
    stores: "opaque refresh token; server stores only hash",
  }),
  adminAuthCookieEntry({
    key: "sessionKey",
    retention: "session or 30 days when keep-signed-in is enabled",
    deletion: "logout, session revocation, or browser cookie deletion",
    stores: "administrator session identifier",
  }),
  {
    area: "localStorage",
    key: "auth.admin.savedEmail.v1",
    purpose: "admin-login-saved-email",
    required: false,
    retention: "until saved email changes, is deselected, or browser storage is cleared",
    deletion: "saved email deselection, replacement, or browser storage deletion",
    stores: "normalized administrator email address only",
  },
  {
    area: "localStorage",
    key: "admin.editor.localDraft.create.",
    purpose: "editor-local-draft-create-prefix",
    required: false,
    retention: "7 days from savedAt or until the owning browser document clears its slot",
    deletion: "owning-slot clear, successful create publish, TTL expiry, or browser storage deletion",
    stores: "document-owned create-context draft title, markdown, canonical summary source and intent, thumbnail, tags, category, visibility, source, savedAt",
  },
  {
    area: "localStorage",
    key: "admin.editor.localDraft.post.",
    purpose: "editor-local-draft-post-prefix",
    required: false,
    retention: "7 days from savedAt or until manually cleared; reject new slots at 20 without evicting valid drafts",
    deletion: "manual clear, successful modify, TTL expiry, or browser storage deletion",
    stores: "per-post current draft payloads with canonical summary source and intent",
  },
  {
    area: "localStorage",
    key: "admin.editor.customTags",
    purpose: "editor-custom-tag-catalog",
    required: false,
    retention: "until catalog changes or browser storage is cleared",
    deletion: "catalog overwrite or browser storage deletion",
    stores: "admin-provided tag labels",
  },
  {
    area: "localStorage",
    key: "admin.editor.customCategories",
    purpose: "editor-custom-category-catalog",
    required: false,
    retention: "until catalog changes or browser storage is cleared",
    deletion: "catalog overwrite or browser storage deletion",
    stores: "admin-provided category labels",
  },
  {
    area: "localStorage",
    key: "admin.contentStudio.listConditions.v1",
    purpose: "admin-list-preference",
    required: false,
    retention: "until list preference changes or browser storage is cleared",
    deletion: "list preference overwrite or browser storage deletion",
    stores: "admin post list filter and sorting conditions",
  },
  {
    area: "localStorage",
    key: "aquila-cloud-video-upload-session",
    purpose: "cloud-video-upload-session-prefix",
    required: false,
    retention: "until upload completes, is cancelled, becomes stale, or browser storage is cleared",
    deletion: "upload completion, cancellation, stale session cleanup, or browser storage deletion",
    stores: "resumable cloud video upload session id keyed by file metadata",
  },
  {
    area: "sessionStorage",
    key: ADMIN_TASK_DLQ_REPLAY_SESSION_KEY,
    purpose: "admin-task-dlq-replay-request",
    required: false,
    retention: "browser tab session while an operation is pending or retained for explicit status checks",
    deletion: "explicit new command, tab close, or browser storage deletion",
    stores: "bounded DLQ replay request with operation UUID, reason, optional task type, limit, and retry-count choice",
  },
  {
    area: "sessionStorage",
    key: ADMIN_SEARCH_RUNTIME_CONTROL_SESSION_KEY,
    purpose: "admin-search-runtime-control-request",
    required: false,
    retention: "browser tab session while one search control operation is pending or retained for explicit status checks",
    deletion: "explicit new command, tab close, or browser storage deletion",
    stores: "one bounded search control request with operation UUID, control name, reason, and explicit boolean target",
  },
  {
    area: "sessionStorage",
    key: "auth:me:anon-probe-suppress-until:v1",
    purpose: "anonymous-auth-probe-suppression",
    required: false,
    retention: "5 minutes or browser tab session end",
    deletion: "auth success, TTL expiry, tab close, or browser storage deletion",
    stores: "timestamp until anonymous auth/me probe should be suppressed",
  },
  {
    area: "sessionStorage",
    key: "admin.tools.resultsFilter.v1",
    purpose: "admin-tools-filter",
    required: false,
    retention: "browser tab session",
    deletion: "tab close, filter overwrite, or browser storage deletion",
    stores: "admin tools result filter mode",
  },
  {
    area: "sessionStorage",
    key: "posts:runtime-endpoints:v1",
    purpose: "posts-runtime-endpoint-trace",
    required: false,
    retention: "browser tab session, capped to last 60 entries",
    deletion: "tab close or browser storage deletion",
    stores: "recent posts endpoint mode diagnostics",
  },
  {
    area: "sessionStorage",
    key: "__aquila_client_runtime_recovery__",
    purpose: "runtime-recovery-prefix",
    required: false,
    retention: "browser tab session",
    deletion: "tab close or browser storage deletion",
    stores: "client runtime recovery marker and reason",
  },
  {
    area: "sessionStorage",
    key: FEED_EXPLORER_RESTORE_KEY_PREFIX,
    purpose: "feed-restore-prefix",
    required: false,
    retention: "browser tab session",
    deletion: "tab close, feed restore cleanup, or browser storage deletion",
    stores: "feed explorer scroll, query, and snapshot restoration state",
  },
]
