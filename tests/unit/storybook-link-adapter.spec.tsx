import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Link, { createStorybookLinkClickHandler } from "../../.storybook/next-link"

const createClickEvent = ({
  altKey = false,
  button = 0,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
}: Partial<{
  altKey: boolean
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}> = {}) => {
  let defaultPrevented = false

  return {
    altKey,
    button,
    ctrlKey,
    get defaultPrevented() {
      return defaultPrevented
    },
    metaKey,
    preventDefault: () => {
      defaultPrevented = true
    },
    shiftKey,
    getDefaultPrevented: () => defaultPrevented,
  }
}

test.describe("storybook link adapter", () => {
  test("renders a modern signup anchor", () => {
    const markup = renderToStaticMarkup(createElement(Link, { href: "/signup" }, "회원가입"))

    expect(markup).toContain('href="/signup"')
  })

  test("preserves a legacy admin posts anchor", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Link,
        { href: "/admin/posts", legacyBehavior: true },
        createElement("a", { className: "admin-posts-link" }, "글 전체 보기")
      )
    )

    expect(markup).toContain('class="admin-posts-link"')
    expect(markup).toContain('href="/admin/posts"')
  })

  test("runs legacy caller handlers before recording an internal route", async () => {
    const calls: string[] = []
    const push = async (href: string) => {
      calls.push(`push:${href}`)
      return true
    }
    const event = createClickEvent()
    const onClick = createStorybookLinkClickHandler({
      callerOnClicks: [
        () => calls.push("child"),
        () => calls.push("link"),
      ],
      download: undefined,
      href: "/admin/posts",
      push,
      target: undefined,
    })

    onClick(event as never)
    await Promise.resolve()

    expect(calls).toEqual(["child", "link", "push:/admin/posts"])
    expect(event.getDefaultPrevented()).toBe(true)
  })

  test("respects caller cancellation and only intercepts an unmodified internal primary click", async () => {
    const routes: string[] = []
    const push = async (href: string) => {
      routes.push(href)
      return true
    }
    const cancelledEvent = createClickEvent()
    const cancelled = createStorybookLinkClickHandler({
      callerOnClicks: [(event) => event.preventDefault()],
      download: undefined,
      href: "/signup",
      push,
      target: "_self",
    })

    cancelled(cancelledEvent as never)
    await Promise.resolve()
    expect(routes).toEqual([])
    expect(cancelledEvent.getDefaultPrevented()).toBe(true)

    const nonInterceptedClicks: Array<{
      download?: string
      event: ReturnType<typeof createClickEvent>
      href: string
      target?: string
    }> = [
      { event: createClickEvent({ altKey: true }), href: "/signup" },
      { event: createClickEvent({ button: 1 }), href: "/signup" },
      { event: createClickEvent({ ctrlKey: true }), href: "/signup" },
      { event: createClickEvent({ metaKey: true }), href: "/signup" },
      { event: createClickEvent({ shiftKey: true }), href: "/signup" },
      { event: createClickEvent(), href: "//example.test" },
      { event: createClickEvent(), href: "/signup", target: "_blank" },
      { event: createClickEvent(), href: "/signup", download: "signup.html" },
    ]

    for (const { download, event, href, target } of nonInterceptedClicks) {
      createStorybookLinkClickHandler({
        callerOnClicks: [],
        download,
        href,
        push,
        target,
      })(event as never)
      expect(event.getDefaultPrevented()).toBe(false)
    }

    await Promise.resolve()
    expect(routes).toEqual([])
  })
})
