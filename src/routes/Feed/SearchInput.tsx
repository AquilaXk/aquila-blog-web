import styled from "@emotion/styled"
import React, {
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import AppIcon from "src/components/icons/AppIcon"
import {
  FEED_SEARCH_FIELD_MIN_HEIGHT_PX,
  MOBILE_TOUCH_TARGET_MIN_PX,
  TOUCH_TOKEN_BUNDLE_REVISION,
} from "./feedUiTokens"
import { FEED_SEARCH_INPUT_ID } from "./feedSearchFocus"

import { useLanguage } from "src/libs/language"

export { FEED_SEARCH_INPUT_ID } from "./feedSearchFocus"

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  inputRef?: Ref<HTMLInputElement>
  onClear?: () => void
  hideClearButton?: boolean
}

const assignInputRef = (targetRef: Ref<HTMLInputElement> | undefined, node: HTMLInputElement | null) => {
  if (!targetRef) return
  if (typeof targetRef === "function") {
    targetRef(node)
  } else {
    (targetRef as React.MutableRefObject<HTMLInputElement | null>).current = node
  }
}

const SearchInput: React.FC<Props> = ({
  inputRef,
  onClear,
  hideClearButton = false,
  onKeyDown,
  ...props
}) => {
  const { t } = useLanguage()
  const inputId = props.id || FEED_SEARCH_INPUT_ID
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K")
  const hasQueryValue =
    typeof props.value === "string"
      ? props.value.length > 0
      : typeof props.value === "number"
        ? String(props.value).length > 0
        : false
  const canClear = !hideClearButton && hasQueryValue && !props.disabled && !props.readOnly

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const navWithUa = navigator as Navigator & { userAgentData?: { platform?: string } }
    const platform = navWithUa.userAgentData?.platform || navigator.platform || ""
    if (/mac|iphone|ipad|ipod/i.test(platform)) {
      setShortcutLabel("⌘K")
    }
  }, [])

  const setMergedRef = useCallback(
    (node: HTMLInputElement | null) => {
      localInputRef.current = node
      assignInputRef(inputRef, node)
    },
    [inputRef]
  )

  const handleClear = useCallback(() => {
    const input = localInputRef.current
    if (onClear) {
      onClear()
    } else if (input) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      valueSetter?.call(input, "")
      props.onChange?.({
        target: input,
        currentTarget: input,
      } as ChangeEvent<HTMLInputElement>)
    }
    input?.focus()
  }, [onClear, props])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.key !== "Escape") return
      if (hasQueryValue && !props.disabled && !props.readOnly) {
        event.preventDefault()
        handleClear()
        return
      }
      event.currentTarget.blur()
    },
    [handleClear, hasQueryValue, onKeyDown, props.disabled, props.readOnly]
  )

  return (
    <StyledWrapper data-touch-token-revision={TOUCH_TOKEN_BUNDLE_REVISION}>
      <div className="field">
        <span className="searchIcon" aria-hidden="true">
          <AppIcon name="search" />
        </span>
        <input
          id={inputId}
          ref={setMergedRef}
          className="mid"
          type="search"
          placeholder={t("searchPlaceholder")}
          aria-label={props["aria-label"] || t("searchInputAria")}
          {...props}
          onKeyDown={handleKeyDown}
        />
        {canClear ? (
          <button
            type="button"
            className="clearButton"
            aria-label={t("searchClearAria")}
            onClick={handleClear}
          >
            <AppIcon name="close" />
          </button>
        ) : !hasQueryValue && !props.disabled ? (
          <span className="shortcutBadge" aria-hidden="true">
            <kbd>{shortcutLabel}</kbd>
            <kbd>/</kbd>
          </span>
        ) : null}
      </div>
    </StyledWrapper>
  )
}

export default SearchInput

const StyledWrapper = styled.div`
  min-width: 0;

  > .field {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    min-height: ${FEED_SEARCH_FIELD_MIN_HEIGHT_PX}px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    transition: border-color 0.125s ease-in, background-color 0.125s ease-in;

    .searchIcon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      color: var(--aq-subtle);
      width: 15px;
      height: 15px;
      transition: color 0.125s ease-in;

      svg {
        width: 15px;
        height: 15px;
      }
    }
  }

  > .field > .mid {
    width: 180px;
    min-width: 0;
    min-height: 34px;
    padding: 0;
    font-size: 0.8125rem;
    font-weight: 560;
    line-height: 1.4;
    color: var(--aq-text);
    caret-color: var(--aq-accent);
    border: 0;
    outline: none;
    box-shadow: none;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.125s ease-in, box-shadow 0.125s ease-in, background-color 0.125s ease-in;

    &::placeholder {
      color: var(--aq-subtle);
      opacity: 1;
      transition: opacity 0.12s ease-in;
    }

    &:focus::placeholder {
      opacity: 0;
    }

    &::-webkit-search-decoration,
    &::-webkit-search-cancel-button,
    &::-webkit-search-results-button,
    &::-webkit-search-results-decoration {
      -webkit-appearance: none;
    }
  }

  > .field > .clearButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
    min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
    margin: -5px -10px -5px 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--aq-subtle);
    cursor: pointer;

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: -2px;
      color: var(--aq-text);
    }

    svg {
      width: 15px;
      height: 15px;
    }
  }

  > .field > .shortcutBadge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 0 0 auto;

    kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 20px;
      padding: 0 5px;
      border-radius: 4px;
      border: 1px solid var(--aq-border);
      background: var(--aq-page-bg);
      color: var(--aq-muted);
      font-family: inherit;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.01em;
    }

    @media (max-width: 820px), (pointer: coarse) {
      display: none;
    }
  }

  > .field:focus-within {
    border-color: var(--aq-accent);
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
    background: var(--aq-surface);
    box-shadow: none;

    .searchIcon {
      color: var(--aq-muted);
    }

    .shortcutBadge {
      display: none;
    }
  }

  @media (max-width: 820px), (pointer: coarse) {
    > .field {
      height: auto;
      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
      padding: 0 0.5rem;
      border-radius: 6px;
    }

    > .field > .mid {
      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
      padding: 0.34rem 0;
      font-size: 1rem;
      line-height: 1.45;
    }
  }

  @media (max-width: 768px) {
    flex: 1 1 0%;
    min-width: 0;

    > .field > .mid {
      width: 100%;
      flex: 1 1 0%;
    }
  }
`
