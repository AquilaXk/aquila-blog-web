import {
  Fragment,
  createElement,
  isValidElement,
  memo,
  type ComponentType,
  type ReactNode,
} from "react"

type PlaywrightJsxDescriptor = {
  __pw_type?: unknown
  $$typeof?: symbol
  type?: unknown
  props?: Record<string, unknown>
  key?: string | number | null
}

type MemoCandidate = {
  $$typeof?: symbol
  type?: unknown
  compare?: ((prevProps: Readonly<Record<string, unknown>>, nextProps: Readonly<Record<string, unknown>>) => boolean) | null
}

const wrappedComponentCache = new WeakMap<object, unknown>()

const isPlaywrightJsxDescriptor = (value: unknown): value is PlaywrightJsxDescriptor =>
  Boolean(
    value &&
      typeof value === "object" &&
      "__pw_type" in value &&
      (value as PlaywrightJsxDescriptor).__pw_type === "jsx"
  )

const isNativeOrEmotionComponent = (fn: (...args: never[]) => unknown): boolean =>
  "__emotion_real" in fn ||
  Boolean((fn as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent)

export const wrapPlaywrightJsxComponent = (type: unknown): unknown => {
  if (!type || (typeof type !== "function" && typeof type !== "object")) {
    return type
  }

  if (typeof type === "function") {
    if (isNativeOrEmotionComponent(type as (...args: never[]) => unknown)) {
      return type
    }
    const cachedFn = wrappedComponentCache.get(type)
    if (cachedFn) return cachedFn
    const renderFn = type as (props: Record<string, unknown>) => unknown
    const Wrapped = (props: Record<string, unknown>) => materializePlaywrightJsx(renderFn(props))
    const meta = type as { displayName?: string; name?: string }
    Wrapped.displayName = meta.displayName || renderFn.name || "PlaywrightWrappedComponent"
    wrappedComponentCache.set(type, Wrapped)
    return Wrapped
  }

  const cachedObject = wrappedComponentCache.get(type)
  if (cachedObject) return cachedObject

  const candidate = type as MemoCandidate
  if (candidate.$$typeof === Symbol.for("react.memo") && candidate.type) {
    const innerWrapped = wrapPlaywrightJsxComponent(candidate.type) as ComponentType<Record<string, unknown>>
    const WrappedMemo = candidate.compare ? memo(innerWrapped, candidate.compare) : memo(innerWrapped)
    wrappedComponentCache.set(type, WrappedMemo)
    return WrappedMemo
  }

  return type
}

const mapComponentsPropRecord = (rawComponents: Record<string, unknown>): Record<string, unknown> => {
  const mapped: Record<string, unknown> = {}
  for (const [tag, component] of Object.entries(rawComponents)) {
    mapped[tag] = wrapPlaywrightJsxComponent(component)
  }
  return mapped
}

export const materializePlaywrightJsx = (node: unknown, index?: number): unknown => {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) {
    return node.map((child, childIndex) => materializePlaywrightJsx(child, childIndex))
  }

  if (isPlaywrightJsxDescriptor(node)) {
    const rawProps = node.props ?? {}
    const { children: rawChildren, ...restProps } = rawProps
    const nextProps: Record<string, unknown> = {}

    for (const [propKey, propValue] of Object.entries(restProps)) {
      if (
        propKey === "components" &&
        propValue &&
        typeof propValue === "object" &&
        !Array.isArray(propValue)
      ) {
        nextProps[propKey] = mapComponentsPropRecord(propValue as Record<string, unknown>)
      } else {
        nextProps[propKey] = materializePlaywrightJsx(propValue)
      }
    }

    const resolvedKey =
      node.key !== undefined && node.key !== null
        ? node.key
        : index !== undefined
          ? `pw-${index}`
          : undefined
    if (resolvedKey !== undefined) {
      nextProps.key = resolvedKey
    }

    const resolvedType = (
      node.type === undefined ||
      (typeof node.type === "object" && node.type !== null && !("$$typeof" in node.type))
        ? Fragment
        : wrapPlaywrightJsxComponent(node.type)
    ) as ComponentType<Record<string, unknown>>

    if (Array.isArray(rawChildren)) {
      const convertedChildren = rawChildren.map((child, childIndex) =>
        materializePlaywrightJsx(child, childIndex)
      ) as ReactNode[]
      return createElement(resolvedType, nextProps, ...convertedChildren)
    }
    if (rawChildren !== undefined) {
      return createElement(
        resolvedType,
        nextProps,
        materializePlaywrightJsx(rawChildren) as ReactNode
      )
    }
    return createElement(resolvedType, nextProps)
  }

  if (isValidElement(node) && node.props && typeof node.props === "object") {
    const elementRecord = node as unknown as PlaywrightJsxDescriptor
    const nextType = wrapPlaywrightJsxComponent(elementRecord.type)
    let changed = nextType !== elementRecord.type
    const rawElementProps = elementRecord.props ?? {}
    const nextProps: Record<string, unknown> = {}

    for (const [propKey, propValue] of Object.entries(rawElementProps)) {
      const converted = materializePlaywrightJsx(propValue)
      if (converted !== propValue) changed = true
      nextProps[propKey] = converted
    }

    if (!changed) return node
    if (elementRecord.key !== undefined && elementRecord.key !== null) {
      nextProps.key = elementRecord.key
    }
    return createElement(nextType as ComponentType<Record<string, unknown>>, nextProps)
  }

  return node
}
