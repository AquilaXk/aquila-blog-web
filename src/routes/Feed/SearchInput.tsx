import styled from "@emotion/styled"
import React, { InputHTMLAttributes, Ref } from "react"
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
}

const SearchInput: React.FC<Props> = ({ inputRef, ...props }) => {
  const { t } = useLanguage()
  const inputId = props.id || FEED_SEARCH_INPUT_ID

  return (
    <StyledWrapper data-touch-token-revision={TOUCH_TOKEN_BUNDLE_REVISION}>
      <div className="field">
        <span className="searchIcon" aria-hidden="true">
          <AppIcon name="search" />
        </span>
        <input
          id={inputId}
          ref={inputRef}
          className="mid"
          type="search"
          placeholder={t("searchPlaceholder")}
          aria-label="Search posts by keyword"
          {...props}
        />
      </div>
    </StyledWrapper>
  )
}

export default SearchInput

const StyledWrapper = styled.div`
  min-width: 0;

  &:focus-within > .field {
    border-color: var(--aq-focus-ring);
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
  }

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
    transition: all 0.125s ease-in;

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

  > .field:focus-within {
    border-color: var(--aq-accent);
    background: var(--aq-surface);
    box-shadow: none;

    .searchIcon {
      color: var(--aq-muted);
    }
  }

  @media (max-width: 820px) {
    > .field {
      height: auto;
      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
      padding: 0 0.5rem;
      border-radius: 6px;
    }

    > .field > .mid {
      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
      padding: 0.34rem 0;
      font-size: 0.82rem;
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
