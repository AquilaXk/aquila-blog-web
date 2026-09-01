import Link from "next/link"
import { useEffect, useState } from "react"
import { CONFIG } from "site.config"
import {
  OPTIONAL_TRACKING_CONSENT_CHANGE_EVENT,
  type OptionalTrackingConsentRecord,
  hasBrowserPrivacyOptOutSignal,
  hasOptionalTrackingConsent,
  readOptionalTrackingConsent,
  setOptionalTrackingConsent,
} from "src/libs/privacy/optionalTrackingConsentCore"
import SettingsLayout from "./SettingsLayout"
import { privacyPageStyles } from "./SettingsPrivacyPage.styles"

const formatDateTime = (value?: string | null) => {
  if (!value) return "미확인"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "미확인"
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

const SettingsPrivacyPage = () => {
  const [consent, setConsent] = useState<OptionalTrackingConsentRecord | null>(null)
  const [trackingAllowed, setTrackingAllowed] = useState(false)
  const [browserPrivacySignal, setBrowserPrivacySignal] = useState(false)

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readOptionalTrackingConsent())
      setTrackingAllowed(hasOptionalTrackingConsent())
      setBrowserPrivacySignal(hasBrowserPrivacyOptOutSignal())
    }

    syncConsent()
    window.addEventListener("storage", syncConsent)
    window.addEventListener(OPTIONAL_TRACKING_CONSENT_CHANGE_EVENT, syncConsent)
    return () => {
      window.removeEventListener("storage", syncConsent)
      window.removeEventListener(OPTIONAL_TRACKING_CONSENT_CHANGE_EVENT, syncConsent)
    }
  }, [])

  const updateConsent = (granted: boolean) => {
    setOptionalTrackingConsent(granted, "settings")
    setConsent(readOptionalTrackingConsent())
    setTrackingAllowed(hasOptionalTrackingConsent())
    setBrowserPrivacySignal(hasBrowserPrivacyOptOutSignal())
  }

  const consentGranted = consent?.state === "granted"

  return (
    <SettingsLayout active="privacy" title="개인정보 관리">
      <div className="settingsGrid">
        <section className="panel" aria-label="선택 analytics와 RUM 설정">
          <h2>선택 분석</h2>
          <p className="lead">
            서비스 품질을 확인하기 위한 접속 분석(analytics)과 성능 측정(RUM)은 선택 항목이며,
            켜지 않아도 글 읽기 기능은 제한되지 않습니다.
          </p>
          <p
            className="statusLine"
            data-tone={trackingAllowed ? "accent" : "neutral"}
            role="status"
            aria-live="polite"
          >
            <span className="statusDot" aria-hidden="true" />
            선택 분석: {trackingAllowed ? "켜짐" : "꺼짐"}
          </p>
          {browserPrivacySignal ? (
            <p className="muted" id="tracking-signal-note">
              브라우저에서 추적 거부를 요청하고 있어 선택 분석은 항상 꺼진 상태로 유지됩니다.
            </p>
          ) : null}
          <div className="actionRow">
            <button
              type="button"
              className="actionSecondary"
              aria-describedby={browserPrivacySignal ? "tracking-signal-note" : undefined}
              disabled={browserPrivacySignal && !consentGranted}
              onClick={() => updateConsent(!consentGranted)}
            >
              {consentGranted ? "선택 분석 끄기" : "선택 분석 켜기"}
            </button>
          </div>
          <details className="detailBlock">
            <summary>내 선택 기록 자세히 보기</summary>
            <dl className="detailList">
              <div>
                <dt>내 선택</dt>
                <dd>{consent ? (consentGranted ? "동의함" : "거부함") : "선택한 적 없음"}</dd>
              </div>
              <div>
                <dt>선택한 시각</dt>
                <dd>{formatDateTime(consent?.updatedAt)}</dd>
              </div>
              <div>
                <dt>선택한 곳</dt>
                <dd>{consent ? "개인정보 설정" : "없음"}</dd>
              </div>
              <div>
                <dt>적용 범위</dt>
                <dd>
                  접속 분석 {consent?.categories.analytics ? "허용" : "차단"} · 성능 측정{" "}
                  {consent?.categories.rum ? "허용" : "차단"}
                </dd>
              </div>
              <div>
                <dt>브라우저 추적 거부 요청</dt>
                <dd>{browserPrivacySignal ? "있음" : "없음"}</dd>
              </div>
            </dl>
          </details>
          <p className="muted">
            처리하는 항목과 외부 처리자는 <Link href="/cookies">쿠키 정책</Link>과{" "}
            <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다. 별도 문의는{" "}
            <a href={"mailto:" + CONFIG.profile.email}>이메일</a>로 접수할 수 있습니다.
          </p>
        </section>
      </div>
      <style jsx>{privacyPageStyles}</style>
    </SettingsLayout>
  )
}

export default SettingsPrivacyPage
