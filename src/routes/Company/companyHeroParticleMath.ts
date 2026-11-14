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
  scale: Float32Array
  seedA: Float32Array
  seedB: Float32Array
  trigBases: Float32Array
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
  const scaleArr = new Float32Array(count)
  scaleArr.fill(0.35)
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
    scale: scaleArr,
    seedA: seedAArr,
    seedB: seedBArr,
    trigBases,
  }
}
