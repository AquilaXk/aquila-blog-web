import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Link from "../../.storybook/next-link"

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
})
