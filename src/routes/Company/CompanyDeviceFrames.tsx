/**
 * 참조 구현:
 * - magicuidesign/magicui (apps/www/registry/magicui/safari.tsx —
 *   MIT License, Copyright (c) 2023 Dillion Verma)
 * - lucide-icons/lucide (icons/chevron-left.svg, chevron-right.svg, lock.svg — ISC License)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { CompanyVectorIcon } from "src/routes/Company/CompanyIcons"

const SafariWindowFrame = styled.figure`
  margin: 0;
  border-radius: 0.875rem;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.phoneShadow};
  overflow: hidden;

  .safariToolbar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid ${light.gridBorder};
    background: ${light.surfaceScaffold};
  }

  .safariNavGroup {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .safariTrafficLights {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;

    span {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 9999px;
      background: ${light.gridBorder};
      border: 1px solid ${light.border};
    }
  }

  .safariChevrons {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    color: ${light.inkMuted};
  }

  .safariAddressPill {
    justify-self: center;
    width: min(100%, 21rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 0.4375rem;
    border: 1px solid ${light.gridBorder};
    background: ${light.surface};
    color: ${light.inkMuted};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.72rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .safariSpacer {
    width: 2.25rem;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
  }
`

export const CompanySafariFrame: React.FC<{
  chromeLabel: string
  src: string
  alt: string
  width: number
  height: number
  dataUi?: string
}> = ({ chromeLabel, src, alt, width, height, dataUi }) => (
  <SafariWindowFrame>
    <div className="safariToolbar" aria-hidden="true">
      <div className="safariNavGroup">
        <div className="safariTrafficLights">
          <span />
          <span />
          <span />
        </div>
        <div className="safariChevrons">
          <CompanyVectorIcon name="chevron-left" size={14} strokeWidth={1.85} />
          <CompanyVectorIcon name="chevron-right" size={14} strokeWidth={1.85} />
        </div>
      </div>
      <div className="safariAddressPill">
        <CompanyVectorIcon name="lock" size={11} strokeWidth={2} />
        <span>{chromeLabel}</span>
      </div>
      <div className="safariSpacer" />
    </div>
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      data-ui={dataUi}
    />
  </SafariWindowFrame>
)
