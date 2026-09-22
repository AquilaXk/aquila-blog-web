const ROUTER_PATH_KEY = "__AQUILA_STORYBOOK_ROUTER_PATH__" as const
const internalPathPattern = /^\/(?!\/)/

type RouterGlobal = typeof globalThis & {
  __AQUILA_STORYBOOK_ROUTER_PATH__?: string
}

const routerGlobal = () => globalThis as RouterGlobal

export const resetStorybookRouterPath = () => {
  delete routerGlobal()[ROUTER_PATH_KEY]
}

export const getStorybookRouterPath = () => routerGlobal()[ROUTER_PATH_KEY]

const push = async (href: unknown) => {
  if (typeof href !== "string" || !internalPathPattern.test(href)) return false

  routerGlobal()[ROUTER_PATH_KEY] = href
  return true
}

const events = {
  on: () => {},
  off: () => {},
  emit: () => {},
}

export const useRouter = () => {
  const currentPath = getStorybookRouterPath() ?? "/"
  return {
    pathname: currentPath,
    asPath: currentPath,
    route: currentPath,
    query: {},
    basePath: "",
    push,
    replace: push,
    reload: () => {},
    back: () => {},
    prefetch: async () => {},
    beforePopState: () => {},
    events,
    isFallback: false,
    isReady: true,
    isPreview: false,
    isLocaleDomain: false,
  }
}

export default { push, useRouter, events }

