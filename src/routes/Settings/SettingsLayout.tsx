import Link from "next/link"
import { ReactNode } from "react"
import { control, layoutBreakpoint } from "src/design-system/tokens"
import { colors } from "src/styles/colors"

type SettingsLayoutProps = {
  active: "privacy"
  title: string
  children: ReactNode
}

const SettingsLayout = ({ active, title, children }: SettingsLayoutProps) => {
  return (
    <main className="settingsPage">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{title}</h1>
          <p className="summary">브라우저의 선택 분석 설정과 공개 개인정보 문서를 관리합니다.</p>
        </div>
        <nav className="tabs" aria-label="설정 메뉴">
          <Link
            className={active === "privacy" ? "active" : ""}
            aria-current={active === "privacy" ? "page" : undefined}
            href="/settings/privacy"
          >
            개인정보
          </Link>
        </nav>
      </header>
      {children}
      <style jsx global>{settingsStyles}</style>
    </main>
  )
}

export const settingsStyles = `
  .settingsPage {
    width: min(980px, calc(100% - 32px));
    margin: 0 auto;
    padding: 48px 0 72px;
    color: var(--aq-text);
    --aq-status-danger: ${colors.light.statusDangerText};
    --aq-status-success: ${colors.light.statusSuccessText};
  }

  html[data-aquila-scheme="dark"] .settingsPage {
    --aq-status-danger: ${colors.dark.statusDangerText};
    --aq-status-success: ${colors.dark.statusSuccessText};
  }

  .pageHeader {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--aq-border);
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--aq-muted);
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .settingsPage h1 {
    margin: 0;
    font-size: 2rem;
    line-height: 1.18;
    letter-spacing: 0;
  }

  .summary {
    margin: 10px 0 0;
    color: var(--aq-text-secondary);
    line-height: 1.6;
  }

  /* 패밀리룩(1219): 필형 탭 그룹 → 헤어라인 위 밑줄 강조 사각 탭 */
  .tabs {
    display: inline-flex;
    gap: 1.4rem;
    border-bottom: 1px solid var(--aq-border);
  }

  .settingsPage .tabs a {
    display: inline-flex;
    align-items: center;
    padding: 0 0 10px;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    color: var(--aq-text-secondary);
    text-align: center;
    text-decoration: none;
    font-weight: 600;
  }

  .settingsPage .tabs a.active {
    color: var(--aq-text);
    border-bottom-color: var(--aq-text);
    font-weight: 700;
  }

  .settingsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    margin-top: 24px;
  }

  /* 패밀리룩(1219): 라운드 카드 패널 → 헤어라인 구획 섹션(면/그림자 제거) */
  .panel {
    padding: 24px 0 0;
    border-top: 1px solid var(--aq-border);
  }

  .panel h2 {
    margin: 0 0 12px;
    font-size: 1.1rem;
    letter-spacing: 0;
  }

  .settingsPage button {
    min-height: 42px;
    padding: 0 16px;
    border: 0;
    border-radius: 7px;
    background: var(--aq-accent);
    color: var(--aq-on-accent);
    font-weight: 800;
    cursor: pointer;
  }

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    .settingsPage .tabs a,
    .settingsPage button {
      min-height: ${control.lg}px;
    }
  }

  .settingsPage button:disabled {
    cursor: not-allowed;
    background: var(--aq-border-strong);
  }

  @media (max-width: ${layoutBreakpoint.editorCompact}px) {
    .settingsPage {
      width: min(100% - 24px, 980px);
      padding-top: 28px;
    }

    .pageHeader {
      align-items: stretch;
      flex-direction: column;
    }

    .tabs {
      width: 100%;
    }

    .settingsPage .tabs a {
      flex: 1;
    }
  }
`

export default SettingsLayout
