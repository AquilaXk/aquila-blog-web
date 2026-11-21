import { expect, test } from "@playwright/test"
import { normalizeProfileWorkspaceContent, type ProfileWorkspaceContent } from "../../src/libs/profileWorkspace"

const workspace: ProfileWorkspaceContent = {
  profileImageUrl: "", profileRole: "", profileBio: "", aboutHeadline: "", aboutRole: "",
  aboutBio: "", aboutSections: [{ id: "notes", title: "Projects", items: ["aquila-blog"], dividerBefore: true }],
  aboutProjectSectionTitle: "", aboutProjects: [], blogTitle: "", homeIntroTitle: "",
  homeIntroDescription: "", blogDesign: "legacy", legacyBlogScheme: "light", serviceLinks: [], contactLinks: [],
}

test("canonical empty projects are not reconstructed from section titles or presets", () => {
  expect(normalizeProfileWorkspaceContent(workspace)).toEqual(workspace)
})

test("explicit projects do not consume a similarly named content section", () => {
  const content = { ...workspace, aboutProjects: [{
    id: "explicit", name: "Project", summary: "", role: "", href: "", linkLabel: "",
  }] }
  expect(normalizeProfileWorkspaceContent(content)).toEqual(content)
})
