import { expect, test } from "@playwright/test"
import {
  resolveToolbarMenuInitialIndex,
  resolveToolbarMenuMoveIndex,
} from "../../src/components/markdown-editor/markdownEditorToolbarMenuModel"

test("opens on the first or last enabled toolbar action", () => {
  const disabled = [true, false, true, false]

  expect(resolveToolbarMenuInitialIndex(disabled, "first")).toBe(1)
  expect(resolveToolbarMenuInitialIndex(disabled, "last")).toBe(3)
})

test("moves within enabled toolbar actions without landing on disabled items", () => {
  const disabled = [false, true, false, false]

  expect(resolveToolbarMenuMoveIndex(disabled, 0, "next")).toBe(2)
  expect(resolveToolbarMenuMoveIndex(disabled, 2, "previous")).toBe(0)
  expect(resolveToolbarMenuMoveIndex(disabled, 3, "next")).toBe(0)
  expect(resolveToolbarMenuMoveIndex(disabled, 0, "previous")).toBe(3)
})

test("returns no active action when every toolbar action is disabled", () => {
  const disabled = [true, true]

  expect(resolveToolbarMenuInitialIndex(disabled, "first")).toBe(-1)
  expect(resolveToolbarMenuMoveIndex(disabled, 0, "next")).toBe(-1)
})
