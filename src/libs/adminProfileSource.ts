export type PublicAdminProfileSource = "published" | "unavailable"
export type StaticAdminProfileSeedSource = PublicAdminProfileSource

export const shouldRefetchAdminProfileSource = (
  source?: PublicAdminProfileSource | null
) => source !== "published"
