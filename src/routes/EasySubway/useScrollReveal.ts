import { useEffect, useRef } from "react"

export type ScrollRevealOptions = {
  selector?: string
  threshold?: number
  rootMargin?: string
  staggerMs?: number
  maxStaggerSteps?: number
}

/**
 * 스크롤 리빌 스태거 트랜지션 딜레이 계산 함수.
 * data-reveal-delay가 명시된 경우 우선 적용하고,
 * 그 외의 경우 그룹 내 순서에 따라 0..3단계(0ms, 60ms, 120ms, 180ms)로 순환 딜레이를 부여한다.
 */
export const calculateRevealDelay = (
  groupIndex: number,
  explicitDelay?: number | string,
  staggerMs = 60,
  maxStaggerSteps = 4
): number => {
  if (explicitDelay !== undefined) {
    const parsed =
      typeof explicitDelay === "string" ? parseInt(explicitDelay, 10) : explicitDelay
    if (!Number.isNaN(parsed)) return parsed
  }
  const step = Math.min(
    groupIndex >= 0 ? groupIndex % maxStaggerSteps : 0,
    maxStaggerSteps - 1
  )
  return step * staggerMs
}

/**
 * EasySubway 에디토리얼 스크롤 리빌(Scroll Reveal) 훅.
 * https://kimhss.github.io/portfolio/ 의 인터랙션 설계와 패리티를 맞추어
 * 뷰포트 진입 시 요소별 순차 페이드인 및 y축 슬라이드업(0.75s cubic-bezier)을 트리거한다.
 *
 * 불변식 & 접근성:
 * 1. prefers-reduced-motion이 켜져 있거나 IntersectionObserver가 없는 환경에서는
 *    즉시 모든 타깃에 .is-visible을 부여하여 모션 어지럼증을 방지하고 콘텐츠 접근성을 보장한다.
 * 2. data-reveal-delay 속성이 명시된 경우 해당 값을 우선하고,
 *    data-reveal-group이 지정된 경우 같은 그룹 내 인덱스에 따라 min(groupIndex % 4, 3) * 60ms 스태거 딜레이를 부여한다.
 * 3. 뷰포트에 1회 진입하여 노출된 요소는 unobserve하여 불필요한 스크롤 재계산 비용을 차단한다.
 */
export const useScrollReveal = <T extends HTMLElement = HTMLDivElement>({
  selector = "[data-reveal]",
  threshold = 0.12,
  rootMargin = "0px 0px -40px",
  staggerMs = 60,
  maxStaggerSteps = 4,
}: ScrollRevealOptions = {}) => {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll<HTMLElement>(selector)
    if (!elements.length) return

    // 1. 사용자 모션 감소 설정(A11y) 확인
    const isReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // 2. IntersectionObserver 미지원 또는 모션 감소 시 즉시 노출
    if (isReducedMotion || typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => {
        el.classList.add("is-visible")
        el.setAttribute("data-visible", "true")
      })
      return
    }

    // 3. 그룹별 단일 패스(O(N)) 스태거 트랜지션 딜레이 설정
    const groupIndices = new Map<string, number>()

    elements.forEach((element, globalIndex) => {
      const explicitDelay = element.dataset.revealDelay
      const groupName = element.dataset.revealGroup

      let indexInGroup = globalIndex
      if (groupName) {
        const currentIndex = groupIndices.get(groupName) ?? 0
        groupIndices.set(groupName, currentIndex + 1)
        indexInGroup = currentIndex
      }

      const delayMs = calculateRevealDelay(
        indexInGroup,
        explicitDelay,
        staggerMs,
        maxStaggerSteps
      )
      element.style.setProperty("--reveal-delay", `${delayMs}ms`)
      element.style.transitionDelay = `${delayMs}ms`
    })

    // 4. 교차 관찰자 등록 (단방향 1회 노출)
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target as HTMLElement
          target.classList.add("is-visible")
          target.setAttribute("data-visible", "true")
          obs.unobserve(target)
        })
      },
      { threshold, rootMargin }
    )

    elements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [selector, threshold, rootMargin, staggerMs, maxStaggerSteps])

  return containerRef
}

export default useScrollReveal
