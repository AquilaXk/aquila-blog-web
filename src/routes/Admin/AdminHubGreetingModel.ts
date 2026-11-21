// 참조 구현: TryGhost/Ghost apps/admin/src/analytics/views/stats/overview/overview.tsx (MIT)
export const ADMIN_HUB_DISPLAY_TIME_ZONE = "Asia/Seoul"

export const ADMIN_HUB_GREETING_OPTIONS = {
  dawn: [
    "고요한 새벽이에요",
    "이른 시간에도 반가워요",
    "차분한 새벽을 시작해요",
    "새벽의 집중력을 이어가요",
  ],
  morning: [
    "좋은 아침이에요",
    "상쾌한 아침이에요",
    "오늘도 기분 좋게 시작해요",
    "아침의 첫 작업을 시작해요",
  ],
  lunch: [
    "점심시간이에요",
    "잠깐 숨을 돌릴 시간이에요",
    "든든한 점심을 챙길 시간이에요",
    "오후를 준비할 시간이에요",
  ],
  afternoon: [
    "좋은 오후예요",
    "오후의 흐름을 이어가요",
    "오늘의 작업을 이어가요",
    "차분하게 집중할 오후예요",
  ],
  evening: [
    "좋은 저녁이에요",
    "오늘 하루도 수고 많았어요",
    "차분한 저녁이에요",
    "오늘의 작업을 마무리해요",
  ],
} as const

export const ADMIN_HUB_GREETING_VARIANT_COUNT = ADMIN_HUB_GREETING_OPTIONS.dawn.length

type AdminHubGreetingPeriod = keyof typeof ADMIN_HUB_GREETING_OPTIONS

export type AdminHubTone = "neutral" | "good" | "warn" | "danger"

export type AdminHubPostListItem = {
  id: number
  title: string
  category?: string | string[]
  published: boolean
  listed: boolean
  tempDraft?: boolean
  modifiedAt: string
  hitCount?: number
}

export type AdminHubPageDto<T> = {
  content?: T[] | null
  pageable?: {
    totalElements?: number
  } | null
}

export type AdminHubSystemHealthPayload = {
  status?: string
  checks?: {
    db?: string
    redis?: string
  } | null
}

export type AdminHubDashboardSnapshotPayload = {
  authSecurity?: {
    recentEventCount?: number
    blockedEventCount?: number
  } | null
  storageCleanup?: {
    eligibleForPurgeCount?: number
    blockedBySafetyThreshold?: boolean
  } | null
  taskQueue?: {
    readyPendingCount?: number
    processingCount?: number
    failedCount?: number
    staleProcessingCount?: number
  } | null
  content?: {
    totalPosts?: number
    publishedPosts?: number
    draftPosts?: number
    privatePosts?: number
    deletedPosts?: number
    totalHitCount?: number
    totalLikesCount?: number
  } | null
}

export type AdminHubOperationalSnapshot = {
  posts: AdminHubPageDto<AdminHubPostListItem> | null
  systemHealth: AdminHubSystemHealthPayload | null
  dashboard: AdminHubDashboardSnapshotPayload | null
  fetchedAt: string | null
}

const seoulHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ADMIN_HUB_DISPLAY_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
})

const resolveGreetingPeriod = (hour: number): AdminHubGreetingPeriod => {
  if (hour < 6) return "dawn"
  if (hour < 11) return "morning"
  if (hour < 14) return "lunch"
  if (hour < 18) return "afternoon"
  return "evening"
}

export const resolveAdminHubGreeting = (instant: Date, variantIndex: number): string => {
  const hourPart = seoulHourFormatter
    .formatToParts(instant)
    .find((part) => part.type === "hour")
  const hour = Number(hourPart?.value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("The administrator greeting requires a valid instant")
  }
  if (!Number.isInteger(variantIndex) || variantIndex < 0 || variantIndex >= ADMIN_HUB_GREETING_VARIANT_COUNT) {
    throw new RangeError("The administrator greeting variant index is out of range")
  }

  return ADMIN_HUB_GREETING_OPTIONS[resolveGreetingPeriod(hour)][variantIndex]
}

export const mergeAdminHubOperationalRefresh = (
  previous: AdminHubOperationalSnapshot,
  results: {
    posts: PromiseSettledResult<AdminHubPageDto<AdminHubPostListItem>>
    systemHealth: PromiseSettledResult<AdminHubSystemHealthPayload>
    dashboard: PromiseSettledResult<AdminHubDashboardSnapshotPayload>
  },
  nowIso: string = new Date().toISOString()
): {
  snapshot: AdminHubOperationalSnapshot
  failedCount: number
  succeededCount: number
} => {
  let failedCount = 0
  let succeededCount = 0

  const resolveValue = <T>(result: PromiseSettledResult<T>, fallback: T | null): T | null => {
    if (result.status === "fulfilled" && result.value != null) {
      succeededCount += 1
      return result.value
    }
    failedCount += 1
    return fallback
  }

  return {
    snapshot: {
      posts: resolveValue(results.posts, previous.posts),
      systemHealth: resolveValue(results.systemHealth, previous.systemHealth),
      dashboard: resolveValue(results.dashboard, previous.dashboard),
      fetchedAt: succeededCount > 0 ? nowIso : previous.fetchedAt,
    },
    failedCount,
    succeededCount,
  }
}
