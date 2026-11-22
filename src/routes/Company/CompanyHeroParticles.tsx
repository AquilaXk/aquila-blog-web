import { useEffect, useRef } from "react"
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import {
  computeCenterClearance,
  computeFrameTrigRates,
  createCursorKinematicsState,
  createParticleSoABuffers,
  resolveParticleClearance,
  stepCursorKinematics,
  stepParticleSpringFieldFromSoA,
  triggerCursorRipple,
} from "./companyHeroParticleMath"

export {
  computeCenterClearance,
  computeFrameTrigRates,
  createCursorKinematicsState,
  createParticleSeeds,
  createParticleSoABuffers,
  evaluateParticleWavesFromSoA,
  resolveParticleClearance,
  smoothstep,
  stepCursorKinematics,
  stepParticleSpringFieldFromSoA,
  triggerCursorRipple,
  type CursorKinematicsState,
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

    let width = 0
    let height = 0
    let rectLeft = 0
    let rectTop = 0
    let rectWidth = 0
    let rectHeight = 0
    let dpr = 1
    let clearance = resolveParticleClearance(1, 1)
    let baseScale = 0.75
    const cursorState = createCursorKinematicsState()
    let isIntersecting = true
    let rectDirty = false
    let rafId: number | null = null
    const startTime = performance.now()
    let prevNow = startTime

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
      baseScale = Math.max(0.75, Math.min(1.25, width / 1280))
    }

    const drawFlowDashParticle = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      halfLen: number,
      cosAngle: number,
      sinAngle: number,
      lineWidth: number,
      alpha: number
    ) => {
      context.globalAlpha = alpha
      context.lineWidth = lineWidth
      context.beginPath()
      context.moveTo(cx - cosAngle * halfLen, cy - sinAngle * halfLen)
      context.lineTo(cx + cosAngle * halfLen, cy + sinAngle * halfLen)
      context.stroke()
    }

    const renderFrame = (now: number) => {
      if (!ctx || width <= 1 || height <= 1) return
      const dtSeconds = Math.max(0.004, Math.min(0.05, (now - prevNow) * 0.001))
      prevNow = now
      const elapsed = (now - startTime) * 0.001
      const time = elapsed * 0.55

      stepCursorKinematics(cursorState, time, dtSeconds)
      const frame = computeFrameTrigRates(time)
      stepParticleSpringFieldFromSoA(particles, cursorState, time, frame, clearance, dtSeconds)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = "round"

      const halfWidth = clearance.cx
      const halfHeight = clearance.cy

      if (cursorState.pointerActive) {
        const auraPx = (cursorState.ringX + 1) * halfWidth
        const auraPy = (cursorState.ringY + 1) * halfHeight
        const auraClearance = computeCenterClearance(auraPx, auraPy, width, height, clearance)
        if (auraClearance > 0.08) {
          const auraRadius = Math.max(140, Math.min(260, width * 0.19))
          const auraGrad = ctx.createRadialGradient(auraPx, auraPy, 0, auraPx, auraPy, auraRadius)
          auraGrad.addColorStop(0, light.particleAuraFill)
          auraGrad.addColorStop(1, light.particleAuraTransparent)
          ctx.globalAlpha = auraClearance * 0.85
          ctx.fillStyle = auraGrad
          ctx.beginPath()
          ctx.arc(auraPx, auraPy, auraRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const {
        bucketCount,
        bucketStarts,
        bucketEnds,
        refX: pRefX,
        refY: pRefY,
        velX: pVelX,
        velY: pVelY,
        scale: pScale,
        energy: pEnergy,
        screenX: pScreenX,
        screenY: pScreenY,
        screenAlpha: pScreenAlpha,
        trigBases,
      } = particles

      const maxLinkDist = Math.max(108, Math.min(215, width * 0.155))
      const maxLinkDistSq = maxLinkDist * maxLinkDist

      // Active constellation filaments (subway line / pipeline motif) around cursor & ripple ring
      if (cursorState.pointerActive || cursorState.rippleStrength > 0.02) {
        ctx.strokeStyle = light.particleFilamentStroke
        ctx.lineWidth = Math.max(0.85, 1.05 * baseScale)
        for (let bucket = 0; bucket < bucketCount; bucket += 1) {
          const start = bucketStarts[bucket]!
          const end = bucketEnds[bucket]!
          for (let i = start; i < end; i += 1) {
            const alphaA = pScreenAlpha[i]!
            const energyA = pEnergy[i]!
            if (alphaA <= 0.06 || energyA <= 0.24) continue
            const ax = pScreenX[i]!
            const ay = pScreenY[i]!
            const neighborLimit = Math.min(end, i + 8)
            for (let j = i + 1; j < neighborLimit; j += 1) {
              const alphaB = pScreenAlpha[j]!
              const energyB = pEnergy[j]!
              if (alphaB <= 0.06 || energyB <= 0.24) continue
              const bx = pScreenX[j]!
              const by = pScreenY[j]!
              const linkDx = bx - ax
              const linkDy = by - ay
              const distSq = linkDx * linkDx + linkDy * linkDy
              if (distSq > maxLinkDistSq || distSq < 16) continue
              const distRatio = 1 - Math.sqrt(distSq) / maxLinkDist
              const linkAlpha = Math.min(alphaA, alphaB) * distRatio * 0.32
              if (linkAlpha <= 0.02) continue
              ctx.globalAlpha = linkAlpha
              ctx.beginPath()
              ctx.moveTo(ax, ay)
              ctx.lineTo(bx, by)
              ctx.stroke()
            }
          }
        }
      }

      for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        const start = bucketStarts[bucket]!
        const end = bucketEnds[bucket]!
        if (start >= end) continue
        ctx.strokeStyle = palette[bucket]!

        for (let i = start; i < end; i += 1) {
          const alpha = pScreenAlpha[i]!
          if (alpha < 0.06) continue

          const px = pScreenX[i]!
          const py = pScreenY[i]!
          const nextScale = pScale[i]!
          const rx = pRefX[i]!
          const ry = pRefY[i]!
          const b = i * 14

          const dx = rx - cursorState.ringX
          const dy = ry - cursorState.ringY
          const dist = Math.hypot(dx, dy)
          const invDist = dist > 1e-4 ? 1 / dist : 0
          const clampedDist = Math.min(1, dist)
          const dispX =
            (trigBases[b + 6]! * frame.c28 + trigBases[b + 7]! * frame.s28) * 0.014 * clampedDist +
            (trigBases[b + 9]! * frame.c10 - trigBases[b + 8]! * frame.s10) * 0.008
          const dispY =
            (trigBases[b + 11]! * frame.c22 - trigBases[b + 10]! * frame.s22) *
              0.014 *
              clampedDist +
            (trigBases[b + 12]! * frame.c10 + trigBases[b + 13]! * frame.s10) * 0.008

          const tx =
            (-dy * 0.72 + dx * 0.38) * invDist + dispX * 4.5 + pVelX[i]! * 24 + cursorState.vx * 6
          const ty =
            (dx * 0.72 + dy * 0.38) * invDist + dispY * 4.5 + pVelY[i]! * 24 + cursorState.vy * 6
          const tNorm = Math.hypot(tx, ty) || 1
          const cosAngle = tx / tNorm
          const sinAngle = ty / tNorm
          const halfLen = (2.8 + nextScale * 2.6 + pEnergy[i]! * 1.4) * baseScale
          const lineWidth = (1.65 + Math.min(1.25, nextScale * 0.45)) * baseScale

          drawFlowDashParticle(ctx, px, py, halfLen, cosAngle, sinAngle, lineWidth, alpha)
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
        renderFrame(performance.now())
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
        prevNow = performance.now()
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
    const toNormalizedPointer = (clientX: number, clientY: number) => {
      if (rectDirty) syncRect()
      if (!rectWidth || !rectHeight) return null
      const nx = ((clientX - rectLeft) / rectWidth) * 2 - 1
      const ny = ((clientY - rectTop) / rectHeight) * 2 - 1
      return { nx, ny }
    }

    const onPointerMove = (event: PointerEvent) => {
      const coords = toNormalizedPointer(event.clientX, event.clientY)
      if (!coords) return
      const { nx, ny } = coords
      if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1) {
        cursorState.pointerActive = false
        return
      }
      cursorState.targetX = Math.max(-1, Math.min(1, nx))
      cursorState.targetY = Math.max(-1, Math.min(1, ny))
      cursorState.pointerActive = true
    }

    const onPointerDown = (event: PointerEvent) => {
      const coords = toNormalizedPointer(event.clientX, event.clientY)
      if (!coords) return
      const { nx, ny } = coords
      if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) return
      cursorState.targetX = Math.max(-1, Math.min(1, nx))
      cursorState.targetY = Math.max(-1, Math.min(1, ny))
      cursorState.pointerActive = true
      triggerCursorRipple(cursorState, nx, ny)
    }

    const onPointerLeave = () => {
      cursorState.pointerActive = false
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
      hostSection.addEventListener("pointerdown", onPointerDown, { passive: true })
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
        hostSection.removeEventListener("pointerdown", onPointerDown)
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
