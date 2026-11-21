import { expect, test } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"

test("V4 공개 헤더는 인증·알림·관리 액션을 포함하지 않는다", () => {
  const navBarSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/NavBar.tsx"), "utf8")

  expect(navBarSource).not.toContain("useAuthSession")
  expect(navBarSource).not.toContain("AuthEntryModal")
  expect(navBarSource).not.toContain("NotificationBell")
  expect(navBarSource).not.toContain('className="loginLink"')
  expect(navBarSource).not.toContain('className="adminLink"')
  expect(navBarSource).not.toContain('className="logoutBtn"')
  expect(navBarSource).not.toContain("handleLogout")
  expect(navBarSource).not.toContain("const NavGhost")
})
