import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Link from "next/link"
import { HeaderLink } from "../../src/routes/Admin/AdminDashboardWorkspace.styles"

test("styled admin Link renders one current anchor with its existing attributes", () => {
  const props = { as: Link, href: "/admin/tools", className: "admin-modern-link",
    "data-variant": "primary", "aria-label": "운영 도구 열기" }
  const markup = renderToStaticMarkup(createElement(HeaderLink, props, "Doctor 실행"))

  expect(markup.match(/<a\b/g)).toHaveLength(1)
  expect(markup).toContain('href="/admin/tools"')
  expect(markup).toContain('class="admin-modern-link')
  expect(markup).toContain('data-variant="primary"')
  expect(markup).toContain('aria-label="운영 도구 열기"')
})
