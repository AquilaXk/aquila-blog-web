import {
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react"

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode
  href: unknown
  legacyBehavior?: boolean
  passHref?: boolean
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ children, href, legacyBehavior = false, passHref: _passHref, ...anchorProps }, ref) => {
    if (typeof href !== "string") {
      throw new TypeError("Storybook next/link adapter requires a string href")
    }

    if (!legacyBehavior) {
      return createElement("a", { ...anchorProps, href, ref }, children)
    }

    if (!isValidElement(children)) {
      throw new TypeError("Storybook next/link legacyBehavior requires one React element")
    }

    return cloneElement(children as ReactElement<AnchorHTMLAttributes<HTMLAnchorElement>>, {
      ...anchorProps,
      href,
      ref,
    })
  }
)

export default Link
