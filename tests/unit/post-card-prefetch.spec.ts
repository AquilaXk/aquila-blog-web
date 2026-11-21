import { expect, test } from "@playwright/test"
import { canPrefetchOnCurrentNetwork } from "../../src/routes/Feed/PostList/PostCard"

test.describe("PostCard network-aware prefetching", () => {
  test("allows prefetch on online visible fast network without saveData", () => {
    const originalNavigator = globalThis.navigator
    const originalDocument = globalThis.document

    try {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: "4g" },
        },
        configurable: true,
      })
      Object.defineProperty(globalThis, "document", {
        value: { visibilityState: "visible" },
        configurable: true,
      })

      expect(canPrefetchOnCurrentNetwork()).toBe(true)
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
    }
  })

  test("blocks prefetch when saveData is enabled", () => {
    const originalNavigator = globalThis.navigator
    const originalDocument = globalThis.document

    try {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: true,
          connection: { saveData: true, effectiveType: "4g" },
        },
        configurable: true,
      })
      Object.defineProperty(globalThis, "document", {
        value: { visibilityState: "visible" },
        configurable: true,
      })

      expect(canPrefetchOnCurrentNetwork()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
    }
  })

  test("blocks prefetch on 2g or slow-2g connections", () => {
    const originalNavigator = globalThis.navigator
    const originalDocument = globalThis.document

    try {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: "2g" },
        },
        configurable: true,
      })
      Object.defineProperty(globalThis, "document", {
        value: { visibilityState: "visible" },
        configurable: true,
      })
      expect(canPrefetchOnCurrentNetwork()).toBe(false)

      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: "slow-2g" },
        },
        configurable: true,
      })
      expect(canPrefetchOnCurrentNetwork()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
    }
  })

  test("blocks prefetch when page is in background (hidden)", () => {
    const originalNavigator = globalThis.navigator
    const originalDocument = globalThis.document

    try {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: "4g" },
        },
        configurable: true,
      })
      Object.defineProperty(globalThis, "document", {
        value: { visibilityState: "hidden" },
        configurable: true,
      })

      expect(canPrefetchOnCurrentNetwork()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
    }
  })

  test("blocks prefetch when offline", () => {
    const originalNavigator = globalThis.navigator
    const originalDocument = globalThis.document

    try {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          onLine: false,
          connection: { saveData: false, effectiveType: "4g" },
        },
        configurable: true,
      })
      Object.defineProperty(globalThis, "document", {
        value: { visibilityState: "visible" },
        configurable: true,
      })

      expect(canPrefetchOnCurrentNetwork()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true })
      Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true })
    }
  })
})
