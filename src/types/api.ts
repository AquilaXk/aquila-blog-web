export type RsData<T = unknown> = {
  resultCode?: string
  msg?: string
  data: T
}

export type PostVisibility = "PRIVATE" | "PUBLIC_UNLISTED" | "PUBLIC_LISTED"
