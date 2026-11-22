export type ParticleSeed = {
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

export type ParticleSoABuffers = {
  count: number
  bucketCount: number
  bucketStarts: Uint16Array
  bucketEnds: Uint16Array
  colorIndices: Uint8Array
  refX: Float32Array
  refY: Float32Array
  posX: Float32Array
  posY: Float32Array
  velX: Float32Array
  velY: Float32Array
  scale: Float32Array
  energy: Float32Array
  screenX: Float32Array
  screenY: Float32Array
  screenAlpha: Float32Array
  seedA: Float32Array
  seedB: Float32Array
  trigBases: Float32Array
}

export type CursorKinematicsState = {
  ringX: number
  ringY: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  speed: number
  pointerActive: boolean
  rippleX: number
  rippleY: number
  rippleRadius: number
  rippleStrength: number
}

export type FrameTrigRates = {
  s14: number
  c14: number
  s10: number
  c10: number
  s085: number
  c085: number
  s28: number
  c28: number
  s22: number
  c22: number
  s09: number
  c09: number
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

export const computeFrameTrigRates = (time: number): FrameTrigRates => ({
  s14: Math.sin(time * 1.4),
  c14: Math.cos(time * 1.4),
  s10: Math.sin(time),
  c10: Math.cos(time),
  s085: Math.sin(time * 0.85),
  c085: Math.cos(time * 0.85),
  s28: Math.sin(time * 2.8),
  c28: Math.cos(time * 2.8),
  s22: Math.sin(time * 2.2),
  c22: Math.cos(time * 2.2),
  s09: Math.sin(time * 0.9),
  c09: Math.cos(time * 0.9),
})

export const evaluateParticleWavesFromSoA = (
  trigBases: Float32Array,
  particleIndex: number,
  frame: FrameTrigRates
) => {
  const b = particleIndex * 14
  const noiseSin = trigBases[b]! * frame.c14 + trigBases[b + 1]! * frame.s14
  const ambientSin = trigBases[b + 2]! * frame.c10 + trigBases[b + 3]! * frame.s10
  const ambientCos = trigBases[b + 5]! * frame.c085 - trigBases[b + 4]! * frame.s085
  const dispXSin = trigBases[b + 6]! * frame.c28 + trigBases[b + 7]! * frame.s28
  const dispXCos = trigBases[b + 9]! * frame.c10 - trigBases[b + 8]! * frame.s10
  const dispYCos = trigBases[b + 11]! * frame.c22 - trigBases[b + 10]! * frame.s22
  const dispYSin = trigBases[b + 12]! * frame.c10 + trigBases[b + 13]! * frame.s10
  const angleJitterSin = trigBases[b + 8]! * frame.c09 + trigBases[b + 9]! * frame.s09
  return { noiseSin, ambientSin, ambientCos, dispXSin, dispXCos, dispYCos, dispYSin, angleJitterSin }
}

const computeGridParticleParams = (row: number, col: number, cols: number, rows: number) => {
  const idx = row * cols + col
  const jitterX = Math.sin(idx * 12.9898 + 78.233) * 0.38
  const jitterY = Math.cos(idx * 45.164 + 19.13) * 0.38
  const refX = ((col + 0.5 + jitterX) / cols) * 2 - 1
  const refY = ((row + 0.5 + jitterY) / rows) * 2 - 1
  const seedA = (Math.sin(idx * 91.7) + 1) * 0.5
  const seedB = (Math.cos(idx * 37.3) + 1) * 0.5
  return { idx, refX, refY, seedA, seedB }
}

export const createParticleSeeds = (
  cols: number,
  rows: number,
  paletteLength: number
): ParticleSeed[] => {
  const seeds: ParticleSeed[] = []
  const safePaletteLen = Math.max(1, paletteLength)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const { idx, refX, refY, seedA, seedB } = computeGridParticleParams(row, col, cols, rows)
      seeds.push({
        refX,
        refY,
        posX: 0,
        posY: 0,
        scale: 0.35,
        seedA,
        seedB,
        colorIndex: idx % safePaletteLen,
      })
    }
  }
  return seeds
}

const fillParticleTrigBases = (
  trigBases: Float32Array,
  slot: number,
  refX: number,
  refY: number,
  seedA: number,
  seedB: number
): void => {
  const b = slot * 14
  const a1 = refX * 6.5 + refY * 5.2
  const a2 = refX * 3.4 + seedA * 4.2
  const a3 = refY * 3.1 + seedB * 4.2
  const a4 = refX * 12
  const a5 = seedA * 6.28
  const a6 = refY * 12
  const a7 = seedB * 6.28
  trigBases[b] = Math.sin(a1)
  trigBases[b + 1] = Math.cos(a1)
  trigBases[b + 2] = Math.sin(a2)
  trigBases[b + 3] = Math.cos(a2)
  trigBases[b + 4] = Math.sin(a3)
  trigBases[b + 5] = Math.cos(a3)
  trigBases[b + 6] = Math.sin(a4)
  trigBases[b + 7] = Math.cos(a4)
  trigBases[b + 8] = Math.sin(a5)
  trigBases[b + 9] = Math.cos(a5)
  trigBases[b + 10] = Math.sin(a6)
  trigBases[b + 11] = Math.cos(a6)
  trigBases[b + 12] = Math.sin(a7)
  trigBases[b + 13] = Math.cos(a7)
}

export const createParticleSoABuffers = (
  cols: number,
  rows: number,
  paletteLength: number
): ParticleSoABuffers => {
  const bucketCount = Math.max(1, paletteLength)
  const count = Math.max(0, cols * rows)
  const bucketStarts = new Uint16Array(bucketCount)
  const bucketEnds = new Uint16Array(bucketCount)
  const counts = new Uint16Array(bucketCount)

  for (let idx = 0; idx < count; idx += 1) {
    counts[idx % bucketCount]! += 1
  }
  let offset = 0
  for (let c = 0; c < bucketCount; c += 1) {
    bucketStarts[c] = offset
    offset += counts[c]!
    bucketEnds[c] = offset
  }

  const writeCursor = new Uint16Array(bucketStarts)
  const colorIndices = new Uint8Array(count)
  const refXArr = new Float32Array(count)
  const refYArr = new Float32Array(count)
  const posXArr = new Float32Array(count)
  const posYArr = new Float32Array(count)
  const velXArr = new Float32Array(count)
  const velYArr = new Float32Array(count)
  const scaleArr = new Float32Array(count)
  scaleArr.fill(0.35)
  const energyArr = new Float32Array(count)
  const screenXArr = new Float32Array(count)
  const screenYArr = new Float32Array(count)
  const screenAlphaArr = new Float32Array(count)
  const seedAArr = new Float32Array(count)
  const seedBArr = new Float32Array(count)
  const trigBases = new Float32Array(count * 14)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const { idx, refX, refY, seedA, seedB } = computeGridParticleParams(row, col, cols, rows)
      const c = idx % bucketCount
      const slot = writeCursor[c]!
      writeCursor[c] = slot + 1

      colorIndices[slot] = c
      refXArr[slot] = refX
      refYArr[slot] = refY
      seedAArr[slot] = seedA
      seedBArr[slot] = seedB
      fillParticleTrigBases(trigBases, slot, refX, refY, seedA, seedB)
    }
  }

  return {
    count,
    bucketCount,
    bucketStarts,
    bucketEnds,
    colorIndices,
    refX: refXArr,
    refY: refYArr,
    posX: posXArr,
    posY: posYArr,
    velX: velXArr,
    velY: velYArr,
    scale: scaleArr,
    energy: energyArr,
    screenX: screenXArr,
    screenY: screenYArr,
    screenAlpha: screenAlphaArr,
    seedA: seedAArr,
    seedB: seedBArr,
    trigBases,
  }
}

export const createCursorKinematicsState = (): CursorKinematicsState => ({
  ringX: 0.18,
  ringY: -0.12,
  targetX: 0.18,
  targetY: -0.12,
  vx: 0,
  vy: 0,
  speed: 0,
  pointerActive: false,
  rippleX: 0,
  rippleY: 0,
  rippleRadius: 0,
  rippleStrength: 0,
})

export const triggerCursorRipple = (
  state: CursorKinematicsState,
  normX: number,
  normY: number
): void => {
  state.rippleX = Math.max(-1, Math.min(1, normX))
  state.rippleY = Math.max(-1, Math.min(1, normY))
  state.rippleRadius = 0.04
  state.rippleStrength = 1
}

export const stepCursorKinematics = (
  state: CursorKinematicsState,
  time: number,
  dtSeconds = 1 / 60
): void => {
  const frameScale = Math.max(0.25, Math.min(3, dtSeconds * 60))
  const wanderX = Math.sin(time * 1.15 + 1.4) * 0.36 + Math.cos(time * 0.52) * 0.14
  const wanderY = Math.cos(time * 0.95 + 0.7) * 0.24 + Math.sin(time * 0.63) * 0.1
  const desiredX = state.pointerActive ? state.targetX * 0.92 + wanderX * 0.08 : wanderX
  const desiredY = state.pointerActive ? state.targetY * 0.92 + wanderY * 0.08 : wanderY
  const baseLerp = state.pointerActive ? 0.14 : 0.03
  const lerpFactor = 1 - Math.pow(1 - baseLerp, frameScale)

  const nextRingX = state.ringX + (desiredX - state.ringX) * lerpFactor
  const nextRingY = state.ringY + (desiredY - state.ringY) * lerpFactor
  const instVx = (nextRingX - state.ringX) / frameScale
  const instVy = (nextRingY - state.ringY) / frameScale
  const velDecay = Math.pow(0.72, frameScale)
  state.vx = state.vx * velDecay + instVx * (1 - velDecay)
  state.vy = state.vy * velDecay + instVy * (1 - velDecay)
  state.speed = Math.min(0.22, Math.hypot(state.vx, state.vy))
  state.ringX = nextRingX
  state.ringY = nextRingY

  if (state.rippleStrength > 0.004) {
    state.rippleRadius += 0.032 * frameScale
    state.rippleStrength *= Math.pow(0.945, frameScale)
    if (state.rippleStrength <= 0.004 || state.rippleRadius > 2.4) {
      state.rippleStrength = 0
    }
  }
}

export const stepParticleSpringFieldFromSoA = (
  particles: ParticleSoABuffers,
  cursor: CursorKinematicsState,
  time: number,
  frame: FrameTrigRates,
  clearance: ParticleClearanceSpec,
  dtSeconds = 1 / 60
): void => {
  const frameScale = Math.max(0.25, Math.min(3, dtSeconds * 60))
  const stiffness = 0.18 * frameScale
  const damping = Math.pow(0.78, frameScale)
  const scaleLerp = 1 - Math.pow(0.8, frameScale)

  const ringRadius = 0.36 + Math.sin(time * 1.3) * 0.036 + Math.cos(time * 2.8) * 0.018
  const ringWidth = 0.24
  const ringWidthInner = 0.09
  const ringDisplacement = 0.15
  const wakeRadius = 0.44
  const hasRipple = cursor.rippleStrength > 0.004
  const invClearRx = 1 / clearance.clearRx
  const invClearRy = 1 / clearance.clearRy
  const innerStopSq = clearance.innerStop * clearance.innerStop
  const outerStopSq = clearance.outerStop * clearance.outerStop
  const halfWidth = clearance.cx
  const halfHeight = clearance.cy

  const {
    count,
    refX,
    refY,
    posX,
    posY,
    velX,
    velY,
    scale,
    energy,
    screenX,
    screenY,
    screenAlpha,
    trigBases,
  } = particles

  for (let i = 0; i < count; i += 1) {
    const rx = refX[i]!
    const ry = refY[i]!
    const b = i * 14

    const dx = rx - cursor.ringX
    const dy = ry - cursor.ringY
    const dist = Math.hypot(dx, dy)
    const invDist = dist > 1e-4 ? 1 / dist : 0
    const noiseJitter = (trigBases[b]! * frame.c14 + trigBases[b + 1]! * frame.s14) * 0.014
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
      (((trigBases[b + 2]! * frame.c10 + trigBases[b + 3]! * frame.s10) +
        (trigBases[b + 5]! * frame.c085 - trigBases[b + 4]! * frame.s085)) *
        0.25 +
        0.5) *
      0.4

    let ripplePulse = 0
    let rippleForceX = 0
    let rippleForceY = 0
    if (hasRipple) {
      const rdx = rx - cursor.rippleX
      const rdy = ry - cursor.rippleY
      const rDist = Math.hypot(rdx, rdy)
      const rDiff = rDist - cursor.rippleRadius
      ripplePulse = Math.exp(-(rDiff * rDiff) / (2 * 0.13 * 0.13)) * cursor.rippleStrength
      if (rDist > 1e-4 && ripplePulse > 0.01) {
        const invR = 1 / rDist
        rippleForceX = rdx * invR * ripplePulse * 0.042
        rippleForceY = rdy * invR * ripplePulse * 0.042
      }
    }

    let wakeForceX = 0
    let wakeForceY = 0
    let wakeEnergy = 0
    if (cursor.pointerActive && dist < wakeRadius) {
      const falloff = 1 - dist / wakeRadius
      const falloffSq = falloff * falloff
      wakeEnergy = falloffSq
      const repel = falloffSq * 0.012
      wakeForceX = dx * invDist * repel + cursor.vx * falloffSq * 0.42
      wakeForceY = dy * invDist * repel + cursor.vy * falloffSq * 0.42
    }

    const pushFactor = Math.sqrt(tInner * Math.sqrt(tInner)) * ringDisplacement
    const targetOffsetX = (rx - cursor.ringX) * pushFactor
    const targetOffsetY = (ry - cursor.ringY) * pushFactor

    const curPosX = posX[i]!
    const curPosY = posY[i]!
    const nextVelX =
      (velX[i]! + (targetOffsetX - curPosX) * stiffness + wakeForceX + rippleForceX) * damping
    const nextVelY =
      (velY[i]! + (targetOffsetY - curPosY) * stiffness + wakeForceY + rippleForceY) * damping
    const nextPosX = curPosX + nextVelX * frameScale
    const nextPosY = curPosY + nextVelY * frameScale

    posX[i] = nextPosX
    posY[i] = nextPosY
    velX[i] = nextVelX
    velY[i] = nextVelY

    const localEnergy = Math.min(1, tInner * 0.85 + tOuter * 0.35 + wakeEnergy * 0.9 + ripplePulse)
    energy[i] = localEnergy

    const targetScale =
      0.34 +
      ambientWave +
      tOuter * 0.95 +
      tInner * 2.05 +
      insideCore * 0.3 +
      wakeEnergy * 0.65 +
      ripplePulse * 1.15
    const nextScale = scale[i]! + (targetScale - scale[i]!) * scaleLerp
    scale[i] = nextScale

    const clampedDist = Math.min(1, dist)
    const dispX =
      (trigBases[b + 6]! * frame.c28 + trigBases[b + 7]! * frame.s28) * 0.014 * clampedDist +
      (trigBases[b + 9]! * frame.c10 - trigBases[b + 8]! * frame.s10) * 0.008
    const dispY =
      (trigBases[b + 11]! * frame.c22 - trigBases[b + 10]! * frame.s22) * 0.014 * clampedDist +
      (trigBases[b + 12]! * frame.c10 + trigBases[b + 13]! * frame.s10) * 0.008

    const px = (rx + dispX + nextPosX * 0.36 + 1) * halfWidth
    const py = (ry + dispY + nextPosY * 0.36 + 1) * halfHeight
    screenX[i] = px
    screenY[i] = py

    const nx = (px - halfWidth) * invClearRx
    const ny = (py - halfHeight) * invClearRy
    const normSq = nx * nx + ny * ny
    if (normSq <= innerStopSq) {
      screenAlpha[i] = 0
      continue
    }

    const centerClearance =
      normSq >= outerStopSq
        ? 1
        : smoothstep(clearance.innerStop, clearance.outerStop, Math.sqrt(normSq))
    const rawAlpha =
      Math.min(clearance.maxAlpha, Math.max(0.14, (nextScale + ripplePulse * 0.35) * 0.44)) *
      centerClearance
    screenAlpha[i] = rawAlpha < 0.06 ? 0 : rawAlpha
  }
}
