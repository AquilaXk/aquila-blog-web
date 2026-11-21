/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/AuthorLayout.tsx, components/Card.tsx, MIT License)
 */
import type { ReactNode } from "react"
import { StyledWrapper } from "./AboutPage.styles"

type AboutPageViewProps = {
  children: ReactNode
}

export const AboutPageView = ({ children }: AboutPageViewProps) => (
  <StyledWrapper>
    <div className="about-content">{children}</div>
  </StyledWrapper>
)
