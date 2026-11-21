/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/Header.tsx, MIT License)
 */
import Link from "next/link"
import { CONFIG } from "site.config"
import styled from "@emotion/styled"
import BrandMark from "src/components/branding/BrandMark"
import { layoutBreakpoint } from "src/design-system/tokens"

type Props = {
  blogTitle?: string
}

const Logo = ({ blogTitle: blogTitleProp }: Props) => {
  const blogTitle = blogTitleProp?.trim() || CONFIG.blog.title

  return (
    <StyledWrapper href="/" aria-label={blogTitle}>
      <div className="logoRow">
        <div className="brandMarkWrap">
          <BrandMark className="brandMark" priority />
        </div>
        <div className="brandText">{blogTitle}</div>
      </div>
    </StyledWrapper>
  )
}

export default Logo

const StyledWrapper = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  color: var(--aq-text);
  text-decoration: none;

  @media (max-width: ${layoutBreakpoint.navCompact}px), (pointer: coarse) {
    min-height: 44px;
  }

  .logoRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }

  .brandMarkWrap {
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .brandMark {
    display: block;
    width: 32px;
    height: 32px;
  }

  .brandText {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 639px) {
      font-size: 1.125rem;
      line-height: 1.5rem;
    }
  }
`
