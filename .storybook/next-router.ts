const ROUTER_PATH_KEY = "__AQUILA_STORYBOOK_ROUTER_PATH__" as const
const postPathPattern = /^\/posts\/\d+$/

type RouterGlobal = typeof globalThis & {
  __AQUILA_STORYBOOK_ROUTER_PATH__?: string
}

const routerGlobal = () => globalThis as RouterGlobal

export const resetStorybookRouterPath = () => {
  delete routerGlobal()[ROUTER_PATH_KEY]
}

export const getStorybookRouterPath = () => routerGlobal()[ROUTER_PATH_KEY]

const push = async (href: unknown) => {
  if (typeof href !== "string" || !postPathPattern.test(href)) return false

  routerGlobal()[ROUTER_PATH_KEY] = href
  return true
}

export default { push }
