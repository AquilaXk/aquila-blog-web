import { getRenderableProfileLinkHref } from "src/constants/profileCardLinks"

export const resolveRenderableProfileLinkHref = (
  section: "service" | "contact",
  href: string
): string | null => getRenderableProfileLinkHref(section, href)
