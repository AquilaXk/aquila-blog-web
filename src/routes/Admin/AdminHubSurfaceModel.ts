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

type AdminHubGreetingPeriod = keyof typeof ADMIN_HUB_GREETING_OPTIONS

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

export const resolveAdminHubGreeting = (instant: Date, selection = Math.random()): string => {
  const hourPart = seoulHourFormatter
    .formatToParts(instant)
    .find((part) => part.type === "hour")
  const hour = Number(hourPart?.value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("The administrator greeting requires a valid instant")
  }
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new RangeError("The administrator greeting selection must be within [0, 1)")
  }

  const options = ADMIN_HUB_GREETING_OPTIONS[resolveGreetingPeriod(hour)]
  return options[Math.floor(selection * options.length)]
}
