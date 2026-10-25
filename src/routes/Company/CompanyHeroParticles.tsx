import { useEffect, useRef } from "react"
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"

type ParticleSeed = {
  refX: number
  refY: number
  posX: number
  posY: number
  scale: number
  seedA: number
  seedB: number
  colorIndex: number
}

export type ParticleClearanceSpec = {
  cx: number
  cy: number
  clearRx: number
  clearRy: number
  innerStop: number
  outerStop: number
  maxAlpha: number
}

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) return 0
  const clamped = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return clamped * clamped * (3 - 2 * clamped)
}

export const resolveParticleClearance = (
  width: number,
  height: number
): ParticleClearanceSpec => {
  const cx = width * 0.5
  const cy = height * 0.5
  if (width < 768) {
    return {
      cx,
      cy,
      clearRx: Math.max(width * 0.56, 210),
      clearRy: Math.max(height * 0.46, 220),
      innerStop: 0.86,
      outerStop: 1.18,
      maxAlpha: 0.48,
    }
  }
  return {
    cx,
    cy,
    clearRx: Math.max(1, Math.min(width * 0.48, 420)),
    clearRy: Math.max(1, Math.min(height * 0.36, 230)),
    innerStop: 0.76,
    outerStop: 1.16,
    maxAlpha: 0.76,
  }
}

export const computeCenterClearance = (
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  spec: ParticleClearanceSpec = resolveParticleClearance(width, height)
) => {
  const cx = spec.cx ?? width * 0.5
  const cy = spec.cy ?? height * 0.5
  const nx = (screenX - cx) / spec.clearRx
  const ny = (screenY - cy) / spec.clearRy
  const normSq = nx * nx + ny * ny
  if (normSq <= spec.innerStop * spec.innerStop) return 0
  if (normSq >= spec.outerStop * spec.outerStop) return 1
  return smoothstep(spec.innerStop, spec.outerStop, Math.sqrt(normSq))
}

export const createParticleSeeds = (cols: number, rows: number, paletteLength: number): ParticleSeed[] => {
  const seeds: ParticleSeed[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col
      const jitterX = Math.sin(idx * 12.9898 + 78.233) * 0.38
      const jitterY = Math.cos(idx * 45.164 + 19.13) * 0.38
      const u = (col + 0.5 + jitterX) / cols
      const v = (row + 0.5 + jitterY) / rows
      const refX = u * 2 - 1
      const refY = v * 2 - 1
      const seedA = (Math.sin(idx * 91.7) + 1) * 0.5
      const seedB = (Math.cos(idx * 37.3) + 1) * 0.5
      seeds.push({
        refX,
        refY,
        posX: 0,
        posY: 0,
        scale: 0.35,
        seedA,
        seedB,
        colorIndex: idx % paletteLength,
      })
    }
  }
  return seeds
}

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
    const particles = createParticleSeeds(cols, rows, palette.length)

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
    let lastFillStyle = ""
    let ringX = 0.18
    let ringY = -0.12
    let targetX = 0.18
    let targetY = -0.12
    let pointerActive = false
    let isIntersecting = true
    let rafId: number | null = null
    const startTime = performance.now()

    const syncRect = () => {
      const rect = container.getBoundingClientRect()
      rectLeft = rect.left
      rectTop = rect.top
      rectWidth = rect.width
      rectHeight = rect.height
      return rect
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
      lastFillStyle = ""
    }

    const drawCapsule = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      angle: number,
      halfLen: number,
      radius: number,
      color: string,
      alpha: number
    ) => {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      context.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, cx * dpr, cy * dpr)
      context.globalAlpha = alpha
      if (color !== lastFillStyle) {
        context.fillStyle = color
        lastFillStyle = color
      }
      context.beginPath()
      if (typeof context.roundRect === "function") {
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

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i]
        const dx = p.refX - ringX
        const dy = p.refY - ringY
        const dist = Math.hypot(dx, dy)
        const noiseJitter = Math.sin(p.refX * 6.5 + p.refY * 5.2 + time * 1.4) * 0.014
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
          ((Math.sin(p.refX * 3.4 + p.seedA * 4.2 + time) +
            Math.cos(p.refY * 3.1 + p.seedB * 4.2 + time * 0.85)) *
            0.25 +
            0.5) *
          0.42

        const targetScale =
          0.26 + ambientWave + tOuter * 0.85 + tInner * 1.95 + insideCore * 0.28

        const dispX =
          Math.sin(p.refX * 12 + time * 2.8) * 0.014 * Math.min(1, dist) +
          Math.cos(p.seedA * 6.28 + time) * 0.008
        const dispY =
          Math.cos(p.refY * 12 + time * 2.2) * 0.014 * Math.min(1, dist) +
          Math.sin(p.seedB * 6.28 + time) * 0.008

        const pushFactor = Math.sqrt(tInner * Math.sqrt(tInner)) * ringDisplacement
        p.posX = p.posX * 0.8 + (p.refX + dispX - ringX) * pushFactor
        p.posY = p.posY * 0.8 + (p.refY + dispY - ringY) * pushFactor
        p.scale += (targetScale - p.scale) * 0.2

        const finalX = p.refX + dispX + p.posX * 0.28
        const finalY = p.refY + dispY + p.posY * 0.28

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
          Math.min(clearance.maxAlpha, Math.max(0.08, p.scale * 0.34)) * centerClearance

        if (alpha < 0.05) continue

        const angle =
          Math.atan2(finalY - ringY, finalX - ringX) +
          Math.sin(p.seedA * 6.28 + time * 0.9) * 0.35

        const halfLen = (2.4 + p.scale * 3.6) * baseScale
        const pillRadius = (1.05 + p.scale * 1.15) * baseScale

        drawCapsule(
          ctx,
          px,
          py,
          angle,
          halfLen,
          pillRadius,
          palette[p.colorIndex],
          alpha
        )
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
    window.addEventListener("scroll", syncRect, { passive: true })
    document.addEventListener("visibilitychange", onVisibilityChange)
    if (finePointer && hostSection) {
      hostSection.addEventListener("pointermove", onPointerMove, { passive: true })
      hostSection.addEventListener("pointerleave", onPointerLeave, { passive: true })
    }

    startLoop()

    return () => {
      stopLoop()
      observer?.disconnect()
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", syncRect)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (finePointer && hostSection) {
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
