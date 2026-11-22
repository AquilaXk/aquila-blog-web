/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/sections/modules-showcase.tsx, MIT License)
 * - lucide-icons/lucide (icons/{globe,shield-check,lock,smartphone}.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import React from "react"
import {
  TECH_SPEC_ITEMS,
  type TechSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as F from "src/routes/EasySubway/EasySubwayFeatures.styles"

type Props = {
  items?: TechSpecItem[]
}

const renderFactIcon = (id: string) => {
  const props = {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  }
  switch (id) {
    case "coverage":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      )
    case "accessibility":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case "privacy":
      return (
        <svg {...props}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </svg>
      )
  }
}

export const EasySubwayTechSpecGrid: React.FC<Props> = ({
  items = TECH_SPEC_ITEMS,
}) => (
  <section role="region" aria-label="정식 출시 기술 명세">
    <F.FactsRow>
      {items.map((item) => (
        <F.FactCell key={item.id} data-reveal="true" data-reveal-group="tech-specs">
          <dt className="factTop">
            {renderFactIcon(item.id)}
            <span>{item.label}</span>
          </dt>
          <dd>
            <strong className="factValue">{item.value}</strong>
            <span className="factDetail">{item.detail}</span>
          </dd>
        </F.FactCell>
      ))}
    </F.FactsRow>
  </section>
)

export default EasySubwayTechSpecGrid
