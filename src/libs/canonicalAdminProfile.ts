import type { AdminProfile } from "src/types/adminProfile"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const strings = (value: Record<string, unknown>, keys: string[], required = false) =>
  keys.every((key) => (!required && value[key] === undefined) || typeof value[key] === "string")
const array = (value: unknown, accepts: (item: unknown) => boolean) =>
  value === undefined || (Array.isArray(value) && value.every(accepts))

// 화면에서 소비하는 형태만 확인한다. 빈 값·추가 필드·원본 객체는 변경하지 않는다.
export const parseCanonicalAdminProfile = (value: unknown): AdminProfile => {
  if (!isRecord(value) ||
    !strings(value, ["username", "name", "nickname", "profileImageUrl"], true) ||
    !strings(value, ["modifiedAt", "profileRole", "profileBio", "aboutHeadline", "aboutRole",
      "aboutBio", "aboutProjectSectionTitle", "blogTitle", "homeIntroTitle",
      "homeIntroDescription", "blogDesign", "legacyBlogScheme"]) ||
    !array(value.aboutSections, (item) => isRecord(item) && strings(item, ["title"], true) &&
      strings(item, ["id"]) && Array.isArray(item.items) && item.items.every((text) => typeof text === "string") &&
      (item.dividerBefore === undefined || typeof item.dividerBefore === "boolean")) ||
    !array(value.aboutProjects, (item) => isRecord(item) && strings(item, ["href"], true) &&
      strings(item, ["id", "name", "summary", "role", "linkLabel"])) ||
    ![value.serviceLinks, value.contactLinks].every((items) => array(items, (item) =>
      isRecord(item) && strings(item, ["label", "href"], true) && strings(item, ["icon"])))) {
    throw new Error("Invalid canonical administrator profile")
  }
  return value as AdminProfile
}
