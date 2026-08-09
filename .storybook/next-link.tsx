import {
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import router from "./next-router"

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode
  href: unknown
  legacyBehavior?: boolean
  passHref?: boolean
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
  ({ children, href, legacyBehavior = false, passHref: _passHref, onClick: linkOnClick, ...anchorProps }, ref) => {
    if (typeof href !== "string") {
      throw new TypeError("Storybook next/link adapter requires a string href")
    }

    if (!legacyBehavior) {
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

    if (!isValidElement(children)) {
      throw new TypeError("Storybook next/link legacyBehavior requires one React element")
    }

    const legacyChild = children as ReactElement<
      AnchorHTMLAttributes<HTMLAnchorElement> & RefAttributes<HTMLAnchorElement>
    >

    return cloneElement(
      legacyChild,
      {
        ...anchorProps,
        href,
        onClick: createStorybookLinkClickHandler({
          callerOnClicks: [legacyChild.props.onClick, linkOnClick],
          download: anchorProps.download ?? legacyChild.props.download,
          href,
          push: router.push,
          target: anchorProps.target ?? legacyChild.props.target,
        }),
        ref,
      }
    )
  }
)

export default Link
