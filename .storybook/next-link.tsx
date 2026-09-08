import {
  createElement,
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
} from "react"
import router from "./next-router"

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode
  href: unknown
}

type StorybookLinkClickHandlerOptions = {
  callerOnClicks: Array<MouseEventHandler<HTMLAnchorElement> | undefined>
  download: AnchorHTMLAttributes<HTMLAnchorElement>["download"]
  href: string
  push: (href: string) => Promise<boolean>
  target: AnchorHTMLAttributes<HTMLAnchorElement>["target"]
}

const internalPathPattern = /^\/(?!\/)/

const isUnmodifiedPrimaryClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

export const createStorybookLinkClickHandler = ({
  callerOnClicks,
  download,
  href,
  push,
  target,
}: StorybookLinkClickHandlerOptions): MouseEventHandler<HTMLAnchorElement> => {
  return (event) => {
    for (const callerOnClick of callerOnClicks) callerOnClick?.(event)

    if (
      event.defaultPrevented ||
      !isUnmodifiedPrimaryClick(event) ||
      (target !== undefined && target !== "_self") ||
      download !== undefined ||
      !internalPathPattern.test(href)
    ) {
      return
    }

    event.preventDefault()
    void push(href)
  }
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ children, href, onClick: linkOnClick, ...anchorProps }, ref) => {
    if (typeof href !== "string") {
      throw new TypeError("Storybook next/link adapter requires a string href")
    }

    return createElement(
      "a",
      {
        ...anchorProps,
        href,
        onClick: createStorybookLinkClickHandler({
          callerOnClicks: [linkOnClick],
          download: anchorProps.download,
          href,
          push: router.push,
          target: anchorProps.target,
        }),
        ref,
      },
      children
    )
  }
)

export default Link
