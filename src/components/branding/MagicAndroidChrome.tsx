/**
 * 참조 구현:
 * - magicuidesign/magicui (apps/www/registry/magicui/android.tsx —
 *   MIT License, Copyright (c) 2023 Dillion Verma)
 */
import type React from "react"
import { marketingLight as light } from "src/design-system/marketingPalette"

export const MagicAndroidHardwareChrome: React.FC = () => (
  <svg
    className="androidHardwareChrome"
    viewBox="0 0 433 882"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M427 175C428.657 175 430 176.343 430 178V283C430 284.657 428.657 286 427 286V175Z"
      fill={light.deviceOuterFill}
    />
    <path
      d="M427 334C428.657 334 430 335.343 430 337V388C430 389.657 428.657 391 427 391V334Z"
      fill={light.deviceOuterFill}
    />
    <rect
      x="184"
      y="10"
      width="65"
      height="4"
      rx="2"
      fill={light.deviceCameraInner}
      fillOpacity="0.45"
    />
    <circle cx="216.5" cy="28" r="9" fill={light.deviceCameraOuter} fillOpacity="0.22" />
    <circle cx="216.5" cy="28" r="4.5" fill={light.deviceCameraInner} fillOpacity="0.6" />
  </svg>
)
