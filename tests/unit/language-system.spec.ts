import { expect, test } from "@playwright/test"
import { translations } from "../../src/libs/language/translations"

test.describe("language system and translations", () => {
  test("ko and en translations have identical key sets", () => {
    const koKeys = Object.keys(translations.ko).sort()
    const enKeys = Object.keys(translations.en).sort()
    expect(koKeys).toEqual(enKeys)
  })

  test("all translation values are non-empty strings", () => {
    for (const value of Object.values(translations.ko)) {
      expect(typeof value).toBe("string")
      expect(value.trim().length).toBeGreaterThan(0)
    }
    for (const value of Object.values(translations.en)) {
      expect(typeof value).toBe("string")
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  test("translations do not contain legacy AI-slop copy", () => {
    const serialized = JSON.stringify(translations)
    expect(serialized).not.toContain("실제 운영에서 마주친 문제와 선택, 검증 결과를 긴 글로 정리합니다.")
    expect(serialized).not.toContain("Latest Notes")
    expect(serialized).not.toContain("Notes on")
    expect(serialized).not.toContain("👋 안녕하세요")
    expect(serialized).not.toContain("기존 빈 목록으로")
    expect(serialized).not.toContain("현재 카드 레이아웃을 유지한 채")
    expect(serialized).not.toContain("소프트웨어 아키텍처와 엔지니어링 탐구 기록")
    expect(serialized).not.toContain("Writing on software architecture and systems engineering")
    expect((translations.ko as Record<string, unknown>).recentPostsSubtitle).toBeUndefined()
    expect((translations.en as Record<string, unknown>).recentPostsSubtitle).toBeUndefined()
    expect(translations.ko.tagTitle).toBe("태그")
    expect(translations.en.tagTitle).toBe("Tags")
    expect(translations.ko.recentPosts).toBe("최근 글")
    expect(translations.en.recentPosts).toBe("Recent Posts")
    expect(translations.ko.navNotes).toBe("글")
    expect(translations.en.navNotes).toBe("Posts")
    expect(translations.ko.navTopics).toBe("태그")
    expect(translations.en.navTopics).toBe("Tags")
  })

  test("recentPosts translation key has no companion subtitle key", () => {
    const keys = Object.keys(translations.ko)
    const subtitleKeys = keys.filter((key) => key.toLowerCase().includes("subtitle"))
    expect(subtitleKeys).toEqual([])
  })
})
