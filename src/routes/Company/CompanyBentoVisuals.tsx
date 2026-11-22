/**
 * 참조 구현:
 * - magicuidesign/magicui (apps/www/registry/example/bento-demo.tsx, animated-list.tsx,
 *   animated-beam.tsx, file-tree.tsx, terminal.tsx — MIT License, Copyright (c) 2023 Dillion Verma)
 * - upptime/upptime (MIT License)
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/{badge.tsx,card.tsx} — MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { CheckGlyph, CompanyVectorIcon, type CompanyIconName } from "src/routes/Company/CompanyIcons"

const BentoStage = styled.div`
  position: relative;
  border-radius: 0.75rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surfaceScaffold};
  padding: 0.875rem;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, black 74%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 74%, transparent 100%);

  @supports not ((mask-image: linear-gradient(black, transparent)) or (-webkit-mask-image: linear-gradient(black, transparent))) {
    padding-bottom: 1.125rem;
  }
`

const AnimatedListStack = styled.div`
  display: grid;
  gap: 0.5rem;
`

const AnimatedListItem = styled.div<{ $highlight?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.8125rem;
  border-radius: 0.6875rem;
  border: 1px solid ${({ $highlight }) => ($highlight ? light.borderBrand : light.gridBorder)};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};

  .itemLeft {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .itemIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    flex-shrink: 0;
    background: ${({ $highlight }) => ($highlight ? light.surfaceBrand : light.surfaceSubtle)};
    color: ${({ $highlight }) => ($highlight ? light.onSignature : light.inkPrimary)};
  }

  .itemCopy {
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }

  .itemTitle {
    color: ${light.inkPrimary};
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .itemMeta {
    color: ${light.inkMuted};
    font-size: 0.72rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .itemBadge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    background: ${light.surfaceBrandChrome};
    border: 1px solid ${light.border};
    color: ${light.emerald};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.6875rem;
    font-weight: 600;
  }
`

const FileTreeWindow = styled.div`
  border-radius: 0.625rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  overflow: hidden;

  .treeHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid ${light.gridBorder};
    background: ${light.surfaceSubtle};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 600;
    color: ${light.inkSecondary};
  }

  .treeList {
    display: grid;
    padding: 0.45rem 0.625rem;
    gap: 0.25rem;
  }

  .treeRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.28rem 0.45rem;
    border-radius: 0.375rem;
    color: ${light.inkPrimary};
    font-size: 0.76rem;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }

  .treeRow--active {
    background: ${light.surfaceBrand};
    color: ${light.onSignature};
    font-weight: 600;
  }

  .treeName {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .treeHint {
    font-size: 0.68rem;
    color: ${light.inkMuted};
  }
`

const BeamGraphWrap = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.25rem;

  .beamCol {
    display: grid;
    gap: 0.45rem;
  }

  .beamNode {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.55rem;
    border: 1px solid ${light.border};
    background: ${light.surface};
    box-shadow: ${light.cardShadowSm};
    color: ${light.inkPrimary};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .beamHub {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.55rem 0.7rem;
    border-radius: 0.75rem;
    border: 1px solid ${light.borderBrand};
    background: ${light.surfaceBrand};
    color: ${light.onSignature};
    box-shadow: ${light.bentoShadow};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .beamConnectorSvg {
    width: 100%;
    height: 2.5rem;
    color: ${light.accent};
  }
`

const MagicTerminal = styled.div`
  border-radius: 0.6875rem;
  border: 1px solid ${light.terminalBorder};
  background: ${light.terminalBg};
  overflow: hidden;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;

  .termBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid ${light.terminalHeaderBorder};
  }

  .termDots {
    display: flex;
    gap: 0.35rem;

    span {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: ${light.terminalDot};
    }
  }

  .termTitle {
    color: ${light.terminalMuted};
    font-size: 0.6875rem;
  }

  .termBody {
    display: grid;
    gap: 0.3rem;
    padding: 0.6875rem 0.875rem;
    font-size: 0.74rem;
    line-height: 1.5;
  }

  .termRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: ${light.terminalText};
  }

  .termOk {
    color: ${light.terminalEmerald};
    font-weight: 600;
  }

  .termDeny {
    color: ${light.terminalRose};
    font-weight: 600;
  }
`

const UptimePanel = styled.div`
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};

  .uptimeHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 600;
    color: ${light.inkPrimary};
  }

  .uptimePill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    border: 1px solid ${light.border};
    background: ${light.surfaceScaffold};
    color: ${light.emerald};
    font-size: 0.68rem;
  }

  .uptimeBars {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 0.22rem;
    height: 1.375rem;
  }

  .uptimeBar {
    border-radius: 0.2rem;
    background: ${light.emerald};
    opacity: 0.86;
  }

  .uptimeBar--standby {
    background: ${light.accent};
    opacity: 0.55;
  }

  .uptimeMeta {
    display: flex;
    justify-content: space-between;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.68rem;
    color: ${light.inkMuted};
  }
`

const QualityGateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
`

const QualityGateCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};

  .gateLeft {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    color: ${light.inkPrimary};
    font-size: 0.78rem;
    font-weight: 600;
  }

  .gateStatus {
    flex-shrink: 0;
    color: ${light.emerald};
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 700;
  }
`

const ROUTE_ITEMS: readonly { icon: CompanyIconName; title: string; meta: string; badge: string; highlight?: boolean }[] = [
  { icon: "train-front", title: "강남역 2호선 → 승강기 B1·B2 직결", meta: "계단 우회 0회 · 최단 무장애 동선", badge: "0cm", highlight: true },
  { icon: "accessibility", title: "9-2번 칸 승차 · 넓은 승강장 간격", meta: "역사 편의시설 실측 좌표 반영", badge: "Verified" },
]

const LOCAL_FILES: readonly { icon: CompanyIconName; name: string; size: string; active?: boolean }[] = [
  { icon: "file-text", name: "proposal.hwpx", size: "Local Only", active: true },
  { icon: "table-2", name: "metrics-q4.xlsx", size: "313 Fn" },
  { icon: "presentation", name: "deck-2026.pptx", size: "0B Sent" },
]

const UPTIME_SLOTS = Array.from({ length: 16 }, (_, idx) => idx)

export const renderMagicBentoStage = (id: string) => {
  switch (id) {
    case "accessibility":
      return (
        <BentoStage aria-hidden="true">
          <AnimatedListStack>
            {ROUTE_ITEMS.map((item) => (
              <AnimatedListItem key={item.title} $highlight={item.highlight}>
                <div className="itemLeft">
                  <span className="itemIcon">
                    <CompanyVectorIcon name={item.icon} size={14} strokeWidth={2} />
                  </span>
                  <div className="itemCopy">
                    <span className="itemTitle">{item.title}</span>
                    <span className="itemMeta">{item.meta}</span>
                  </div>
                </div>
                <span className="itemBadge">
                  <CheckGlyph size={11} />
                  <span>{item.badge}</span>
                </span>
              </AnimatedListItem>
            ))}
          </AnimatedListStack>
        </BentoStage>
      )
    case "local-engine":
      return (
        <BentoStage aria-hidden="true">
          <FileTreeWindow>
            <div className="treeHeader">
              <span>vault/workspace</span>
              <span>Offline</span>
            </div>
            <div className="treeList">
              {LOCAL_FILES.map((file) => (
                <div key={file.name} className={file.active ? "treeRow treeRow--active" : "treeRow"}>
                  <span className="treeName">
                    <CompanyVectorIcon name={file.icon} size={13} strokeWidth={1.9} />
                    <span>{file.name}</span>
                  </span>
                  <span className="treeHint">{file.size}</span>
                </div>
              ))}
            </div>
          </FileTreeWindow>
        </BentoStage>
      )
    case "sandbox-convert":
      return (
        <BentoStage aria-hidden="true">
          <BeamGraphWrap>
            <div className="beamCol">
              <span className="beamNode">308 Formats</span>
              <span className="beamNode">HWPX / PDF</span>
            </div>
            <svg className="beamConnectorSvg" viewBox="0 0 60 40" fill="none">
              <path d="M0 10C22 10 38 20 60 20" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
              <path d="M0 30C22 30 38 20 60 20" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
            </svg>
            <div className="beamHub">
              <CompanyVectorIcon name="cpu" size={16} strokeWidth={1.9} />
              <span>Sandbox</span>
            </div>
            <svg className="beamConnectorSvg" viewBox="0 0 60 40" fill="none">
              <path d="M0 20C22 20 38 20 60 20" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
            </svg>
            <span className="beamNode">
              <CheckGlyph size={12} />
              <span>Wipe</span>
            </span>
          </BeamGraphWrap>
        </BentoStage>
      )
    case "resilience":
      return (
        <BentoStage aria-hidden="true">
          <MagicTerminal>
            <div className="termBar">
              <div className="termDots">
                <span />
                <span />
                <span />
              </div>
              <span className="termTitle">preflight-guard</span>
            </div>
            <div className="termBody">
              <div className="termRow">
                <span>$ header.probe(magicBytes, max100MP)</span>
                <span className="termOk">PASS</span>
              </div>
              <div className="termRow">
                <span>$ net.unfurl(privateCidrBlocklist)</span>
                <span className="termDeny">FAIL-CLOSED</span>
              </div>
            </div>
          </MagicTerminal>
        </BentoStage>
      )
    case "operations":
      return (
        <BentoStage aria-hidden="true">
          <UptimePanel>
            <div className="uptimeHeader">
              <span>Blue / Green Switch</span>
              <span className="uptimePill">
                <CheckGlyph size={11} />
                <span>200 OK</span>
              </span>
            </div>
            <div className="uptimeBars">
              {UPTIME_SLOTS.map((slot) => (
                <span
                  key={slot}
                  className={slot >= 12 ? "uptimeBar uptimeBar--standby" : "uptimeBar"}
                />
              ))}
            </div>
            <div className="uptimeMeta">
              <span>BLUE Active</span>
              <span>GREEN Standby</span>
            </div>
          </UptimePanel>
        </BentoStage>
      )
    default:
      return (
        <BentoStage aria-hidden="true">
          <QualityGateGrid>
            <QualityGateCell>
              <span className="gateLeft">
                <CompanyVectorIcon name="accessibility" size={14} strokeWidth={1.9} />
                <span>axe A11y</span>
              </span>
              <span className="gateStatus">PASS</span>
            </QualityGateCell>
            <QualityGateCell>
              <span className="gateLeft">
                <CompanyVectorIcon name="layers" size={14} strokeWidth={1.9} />
                <span>Bundle Budget</span>
              </span>
              <span className="gateStatus">OK</span>
            </QualityGateCell>
            <QualityGateCell>
              <span className="gateLeft">
                <CompanyVectorIcon name="git-branch" size={14} strokeWidth={1.9} />
                <span>OpenAPI 3.1</span>
              </span>
              <span className="gateStatus">SYNC</span>
            </QualityGateCell>
            <QualityGateCell>
              <span className="gateLeft">
                <CompanyVectorIcon name="terminal" size={14} strokeWidth={1.9} />
                <span>Playwright E2E</span>
              </span>
              <span className="gateStatus">PASS</span>
            </QualityGateCell>
          </QualityGateGrid>
        </BentoStage>
      )
  }
}
