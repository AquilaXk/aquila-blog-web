import { expect, test } from "@playwright/test"
import { createStorybookPlaywrightConfig } from "../../playwright.storybook.config"
import { resolveStorybookStaticPort } from "../../.storybook/storybook-static-port"

test.describe("storybook custom port config", () => {
  test("defaults only an undefined port and rejects noncanonical values", () => {
    expect(resolveStorybookStaticPort(undefined)).toBe(6006)

    for (const value of ["", "01", "1.0", "+1", "0", "65536", " 6106", "6106 "]) {
      expect(() => resolveStorybookStaticPort(value)).toThrow()
    }
  })

  test("shares a normalized custom port with the smoke server and browser", () => {
    const config = createStorybookPlaywrightConfig(6106)

    expect(config.use?.baseURL).toBe("http://127.0.0.1:6106")
    expect(config.webServer).toMatchObject({
      env: { STORYBOOK_STATIC_PORT: "6106" },
      url: "http://127.0.0.1:6106",
    })
  })
})
