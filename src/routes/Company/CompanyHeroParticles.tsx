import { useEffect, useRef } from "react"
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import {
  computeFrameTrigRates,
  createParticleSoABuffers,
  resolveParticleClearance,
  smoothstep,
} from "./companyHeroParticleMath"

export {
  computeCenterClearance,
  computeFrameTrigRates,
  createParticleSeeds,
  createParticleSoABuffers,
  evaluateParticleWavesFromSoA,
  resolveParticleClearance,
  smoothstep,
  type FrameTrigRates,
  type ParticleClearanceSpec,
  type ParticleSeed,
  type ParticleSoABuffers,
} from "./companyHeroParticleMath"

const ParticlesStage = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0.88;
  }
`

const CompanyHeroParticles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || typeof window === "undefined") return

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext("2d")
    } catch {
      ctx = null
    }
    if (!ctx) return

    const palette = light.particleColors
    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const cols = finePointer ? 22 : 15
    const rows = finePointer ? 12 : 9
    const particles = createParticleSoABuffers(cols, rows, palette.length)
    const supportsRoundRect = typeof ctx.roundRect === "function"

    let width = 0
    let height = 0
    let rectLeft = 0
    let rectTop = 0
    let rectWidth = 0
    let rectHeight = 0
    let dpr = 1
    let clearance = resolveParticleClearance(1, 1)
    let invClearRx = 1 / clearance.clearRx
    let invClearRy = 1 / clearance.clearRy
    let innerStopSq = clearance.innerStop * clearance.innerStop
    let outerStopSq = clearance.outerStop * clearance.outerStop
    let baseScale = 0.75
    let ringX = 0.18
    let ringY = -0.12
    let targetX = 0.18
    let targetY = -0.12
    let pointerActive = false
    let isIntersecting = true
    let rectDirty = false
    let rafId: number | null = null
    const startTime = performance.now()

    const syncRect = () => {
      const rect = container.getBoundingClientRect()
      rectLeft = rect.left
      rectTop = rect.top
      rectWidth = rect.width
      rectHeight = rect.height
      rectDirty = false
      return rect
    }
    const markRectDirty = () => {
      rectDirty = true
    }

    const syncSize = () => {
      const rect = syncRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, finePointer ? 2 : 1.5)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      clearance = resolveParticleClearance(width, height)
      invClearRx = 1 / clearance.clearRx
      invClearRy = 1 / clearance.clearRy
      innerStopSq = clearance.innerStop * clearance.innerStop
      outerStopSq = clearance.outerStop * clearance.outerStop
      baseScale = Math.max(0.75, Math.min(1.25, width / 1280))
    }

    const drawCapsule = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      angle: number,
      halfLen: number,
      radius: number,
      alpha: number
    ) => {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      context.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, cx * dpr, cy * dpr)
      context.globalAlpha = alpha
      context.beginPath()
      if (supportsRoundRect) {
        context.roundRect(-halfLen, -radius, halfLen * 2, radius * 2, radius)
      } else {
        context.rect(-halfLen, -radius, halfLen * 2, radius * 2)
      }
      context.fill()
    }

    const renderFrame = (now: number) => {
      if (!ctx || width <= 1 || height <= 1) return
      const elapsed = (now - startTime) * 0.001
      const time = elapsed * 0.55

      const wanderX = Math.sin(time * 1.15 + 1.4) * 0.36 + Math.cos(time * 0.52) * 0.14
      const wanderY = Math.cos(time * 0.95 + 0.7) * 0.24 + Math.sin(time * 0.63) * 0.1
      const desiredX = pointerActive ? targetX * 0.78 + wanderX * 0.22 : wanderX
      const desiredY = pointerActive ? targetY * 0.78 + wanderY * 0.22 : wanderY
      const lerpFactor = pointerActive ? 0.055 : 0.025

      ringX += (desiredX - ringX) * lerpFactor
      ringY += (desiredY - ringY) * lerpFactor

      const ringRadius = 0.34 + Math.sin(time * 1.3) * 0.04 + Math.cos(time * 2.8) * 0.022
      const ringWidth = 0.18
      const ringWidthInner = 0.075
      const ringDisplacement = 0.16

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const halfWidth = clearance.cx
      const halfHeight = clearance.cy
      const {
        s14, c14, s10, c10, s085, c085, s28, c28, s22, c22, s09, c09,
      } = computeFrameTrigRates(time)
      const {
        bucketCount, bucketStarts, bucketEnds,
        refX: pRefX, refY: pRefY, posX: pPosX, posY: pPosY, scale: pScale, trigBases,
      } = particles

      for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        const start = bucketStarts[bucket]!
        const end = bucketEnds[bucket]!
        if (start >= end) continue
        ctx.fillStyle = palette[bucket]!

        for (let i = start; i < end; i += 1) {
          const rx = pRefX[i]!
          const ry = pRefY[i]!
          const b = i * 14

          const dx = rx - ringX
          const dy = ry - ringY
          const dist = Math.hypot(dx, dy)
          const noiseJitter = (trigBases[b]! * c14 + trigBases[b + 1]! * s14) * 0.014
          const distJittered = Math.max(0, dist + noiseJitter)

          const bandOuter =
            smoothstep(ringRadius - ringWidth * 2, ringRadius, dist) -
            smoothstep(ringRadius, ringRadius + ringWidth, distJittered)
          const bandInner =
            smoothstep(ringRadius - ringWidthInner * 2, ringRadius, dist) -
            smoothstep(ringRadius, ringRadius + ringWidthInner, distJittered)
          const insideCore = smoothstep(ringRadius + ringWidthInner, ringRadius, dist)

          const clampedOuter = Math.max(0, bandOuter)
          const clampedInner = Math.max(0, bandInner)
          const tOuter = clampedOuter * clampedOuter
          const tInner = clampedInner * clampedInner * clampedInner
          const ambientWave =
            (((trigBases[b + 2]! * c10 + trigBases[b + 3]! * s10) +
              (trigBases[b + 5]! * c085 - trigBases[b + 4]! * s085)) *
              0.25 +
              0.5) *
            0.42

          const targetScale =
            0.26 + ambientWave + tOuter * 0.85 + tInner * 1.95 + insideCore * 0.28

          const clampedDist = Math.min(1, dist)
          const dispX =
            (trigBases[b + 6]! * c28 + trigBases[b + 7]! * s28) * 0.014 * clampedDist +
            (trigBases[b + 9]! * c10 - trigBases[b + 8]! * s10) * 0.008
          const dispY =
            (trigBases[b + 11]! * c22 - trigBases[b + 10]! * s22) * 0.014 * clampedDist +
            (trigBases[b + 12]! * c10 + trigBases[b + 13]! * s10) * 0.008

          const pushFactor = Math.sqrt(tInner * Math.sqrt(tInner)) * ringDisplacement
          const nextPosX = pPosX[i]! * 0.8 + (rx + dispX - ringX) * pushFactor
          const nextPosY = pPosY[i]! * 0.8 + (ry + dispY - ringY) * pushFactor
          const nextScale = pScale[i]! + (targetScale - pScale[i]!) * 0.2
          pPosX[i] = nextPosX
          pPosY[i] = nextPosY
          pScale[i] = nextScale

          const finalX = rx + dispX + nextPosX * 0.28
          const finalY = ry + dispY + nextPosY * 0.28

          const px = (finalX + 1) * halfWidth
          const py = (finalY + 1) * halfHeight
          const nx = (px - halfWidth) * invClearRx
          const ny = (py - halfHeight) * invClearRy
          const normSq = nx * nx + ny * ny
          if (normSq <= innerStopSq) continue

          const centerClearance =
            normSq >= outerStopSq
              ? 1
              : smoothstep(clearance.innerStop, clearance.outerStop, Math.sqrt(normSq))
          const alpha =
            Math.min(clearance.maxAlpha, Math.max(0.08, nextScale * 0.34)) * centerClearance

          if (alpha < 0.05) continue

          const angle =
            Math.atan2(finalY - ringY, finalX - ringX) +
            (trigBases[b + 8]! * c09 + trigBases[b + 9]! * s09) * 0.35

          const halfLen = (2.4 + nextScale * 3.6) * baseScale
          const pillRadius = (1.05 + nextScale * 1.15) * baseScale

          drawCapsule(ctx, px, py, angle, halfLen, pillRadius, alpha)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
    }

    syncSize()

    if (reducedMotion) {
      renderFrame(startTime + 1200)
      const onResizeReduced = () => {
        syncSize()
        renderFrame(startTime + 1200)
      }
      window.addEventListener("resize", onResizeReduced, { passive: true })
      return () => {
        window.removeEventListener("resize", onResizeReduced)
      }
    }

    const loop = (now: number) => {
      if (!isIntersecting || document.hidden) {
        rafId = null
        return
      }
      renderFrame(now)
      rafId = window.requestAnimationFrame(loop)
    }

    const startLoop = () => {
      if (rafId === null && isIntersecting && !document.hidden) {
        rafId = window.requestAnimationFrame(loop)
      }
    }

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const hostSection = container.parentElement
    const onPointerMove = (event: PointerEvent) => {
      if (rectDirty) syncRect()
      if (!rectWidth || !rectHeight) return
      const nx = ((event.clientX - rectLeft) / rectWidth) * 2 - 1
      const ny = ((event.clientY - rectTop) / rectHeight) * 2 - 1
      if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1) {
        pointerActive = false
        return
      }
      targetX = Math.max(-1, Math.min(1, nx))
      targetY = Math.max(-1, Math.min(1, ny))
      pointerActive = true
    }

    const onPointerLeave = () => {
      pointerActive = false
    }

    const onResize = () => {
      syncSize()
      renderFrame(performance.now())
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopLoop()
      } else {
        startLoop()
      }
    }

    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isIntersecting = entry.isIntersecting
            if (entry.isIntersecting && !document.hidden) {
              startLoop()
            } else {
              stopLoop()
            }
          })
        },
        { rootMargin: "120px 0px", threshold: 0 }
      )
      observer.observe(container)
    }

    window.addEventListener("resize", onResize, { passive: true })
    document.addEventListener("visibilitychange", onVisibilityChange)
    if (finePointer && hostSection) {
      window.addEventListener("scroll", markRectDirty, { passive: true })
      hostSection.addEventListener("pointermove", onPointerMove, { passive: true })
      hostSection.addEventListener("pointerleave", onPointerLeave, { passive: true })
    }

    startLoop()

    return () => {
      stopLoop()
      observer?.disconnect()
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (finePointer && hostSection) {
        window.removeEventListener("scroll", markRectDirty)
        hostSection.removeEventListener("pointermove", onPointerMove)
        hostSection.removeEventListener("pointerleave", onPointerLeave)
      }
    }
  }, [])

  return (
    <ParticlesStage ref={containerRef} aria-hidden="true" data-ui="company-hero-particles">
      <canvas ref={canvasRef} />
    </ParticlesStage>
  )
}

export default CompanyHeroParticles
