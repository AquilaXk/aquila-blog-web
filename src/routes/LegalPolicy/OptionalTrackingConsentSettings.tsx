import Link from "next/link"
import { useEffect, useState } from "react"
import {
  OPTIONAL_TRACKING_CONSENT_CHANGE_EVENT,
  type OptionalTrackingConsentRecord,
  hasBrowserPrivacyOptOutSignal,
  hasOptionalTrackingConsent,
  readOptionalTrackingConsent,
  setOptionalTrackingConsent,
} from "src/libs/privacy/optionalTrackingConsentCore"

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
})

const formatDateTime = (value?: string | null) => {
  if (!value) return "미확인"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "미확인" : dateTimeFormatter.format(parsed)
}

const sourceLabels: Record<OptionalTrackingConsentRecord["source"], string> = {
  settings: "쿠키 설정",
  "signup-email": "이메일 회원가입",
  "signup-social": "소셜 회원가입",
  "privacy-request": "개인정보 처리 요청",
  "legal-reconsent": "법적 문서 재동의",
  "legacy-string": "이전 저장 형식",
}

const OptionalTrackingConsentSettings = () => {
  const [consent, setConsent] = useState<OptionalTrackingConsentRecord | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [browserPrivacySignal, setBrowserPrivacySignal] = useState(false)

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readOptionalTrackingConsent())
      setAllowed(hasOptionalTrackingConsent())
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

  const trackingGranted = consent?.state === "granted"

  const updateConsent = (granted: boolean) => {
    setOptionalTrackingConsent(granted, "settings")
    setConsent(readOptionalTrackingConsent())
    setAllowed(hasOptionalTrackingConsent())
    setBrowserPrivacySignal(hasBrowserPrivacyOptOutSignal())
  }

  return (
    <section className="cookieSettings" id="cookie-settings" aria-label="선택 analytics와 RUM 설정">
      <h2>선택 분석</h2>
      <p>
        로그인과 보안에 필요한 쿠키는 필수입니다. 서비스 품질을 확인하기 위한 접속 분석(analytics)과 성능 측정(RUM)은
        선택 항목이며, 켜지 않아도 글 읽기 기능은 제한되지 않습니다.
      </p>
      <p className="cookieSettingsStatus" role="status" aria-live="polite">
        선택 분석: {allowed ? "켜짐" : "꺼짐"}
      </p>
      {browserPrivacySignal ? (
        <p id="tracking-signal-note">브라우저에서 추적 거부를 요청하고 있어 선택 분석은 항상 꺼진 상태로 유지됩니다.</p>
      ) : null}
      <button
        type="button"
        aria-describedby={browserPrivacySignal ? "tracking-signal-note" : undefined}
        disabled={browserPrivacySignal && !trackingGranted}
        onClick={() => updateConsent(!trackingGranted)}
      >
        {trackingGranted ? "선택 분석 끄기" : "선택 분석 켜기"}
      </button>
      <details>
        <summary>내 선택 기록 자세히 보기</summary>
        <dl>
          <div>
            <dt>내 선택</dt>
            <dd>{consent ? (consent.state === "granted" ? "동의함" : "거부함") : "선택한 적 없음"}</dd>
          </div>
          <div>
            <dt>선택한 시각</dt>
            <dd>{formatDateTime(consent?.updatedAt)}</dd>
          </div>
          <div>
            <dt>선택한 곳</dt>
            <dd>{consent ? sourceLabels[consent.source] || consent.source : "없음"}</dd>
          </div>
        </dl>
      </details>
      <p>
        처리하는 항목과 외부 처리자는 <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다.
      </p>
    </section>
  )
}

export default OptionalTrackingConsentSettings
