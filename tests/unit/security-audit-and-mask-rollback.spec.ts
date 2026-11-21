import { EventEmitter } from "node:events"
import { Readable } from "node:stream"
import { expect, test } from "@playwright/test"
import backendProxyHandler from "../../src/pages/api/backend/[...path]"
import {
  probeImageHeaderFromBytes,
  readAndProbeImageFileHeader,
} from "../../src/libs/imageUploadHeaderProbe"
import {
  buildProfileImageEditedFile,
  preparePostImageForUpload,
} from "../../src/libs/profileImageUpload"
import {
  collectCommonMarkCodeBlockRanges,
  inspectCommonMarkLineMasks,
  parseCommonMarkBlockRanges,
} from "../../src/libs/markdown/commonMarkCodeBlockRanges"
import {
  LINE_BIT_CONTAINER,
  LINE_BIT_INDENTED_CODE,
  LINE_BIT_MATH,
} from "../../src/libs/markdown/commonMarkLineMaskScanner"
import { escapeNonPandocSingleDollars } from "../../src/libs/markdown/inlineMathGuardModel"
import {
  invalidateServerSnapshotCache,
  readServerSnapshot,
} from "../../src/libs/server/serverSnapshotCache"

const makeJpegSegment = (marker: number, payload: Uint8Array): Uint8Array => {
  const segLen = payload.length + 2
  const out = new Uint8Array(2 + 2 + payload.length)
  out[0] = 0xff
  out[1] = marker & 0xff
  out[2] = (segLen >>> 8) & 0xff
  out[3] = segLen & 0xff
  out.set(payload, 4)
  return out
}

const makeJpegSof0Segment = (width: number, height: number): Uint8Array =>
  makeJpegSegment(
    0xc0,
    new Uint8Array([
      0x08,
      (height >>> 8) & 0xff,
      height & 0xff,
      (width >>> 8) & 0xff,
      width & 0xff,
      0x03,
      0x01,
      0x11,
      0x00,
      0x02,
      0x11,
      0x01,
      0x03,
      0x11,
      0x01,
    ])
  )

const toBytesFile = (bytes: Uint8Array, name: string, type: string): File =>
  new File([bytes as BlobPart], name, { type })

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }
  return merged
}

const makeWebpVp8Header = (width: number, height: number): Uint8Array =>
  new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, // "VP8 "
    0x0a, 0x00, 0x00, 0x00, // chunk size = 10
    0x00, 0x00, 0x00, // keyframe 3-byte tag (bit 0 == 0)
    0x9d, 0x01, 0x2a, // VP8 start code
    width & 0xff, (width >>> 8) & 0x3f,
    height & 0xff, (height >>> 8) & 0x3f,
  ])

const makeWebpVp8xHeader = (width: number, height: number, hasAlpha = false): Uint8Array => {
  const wMinus1 = width - 1
  const hMinus1 = height - 1
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, // "VP8X"
    0x0a, 0x00, 0x00, 0x00, // chunk size = 10
    hasAlpha ? 0x10 : 0x00, 0x00, 0x00, 0x00,
    wMinus1 & 0xff, (wMinus1 >>> 8) & 0xff, (wMinus1 >>> 16) & 0xff,
    hMinus1 & 0xff, (hMinus1 >>> 8) & 0xff, (hMinus1 >>> 16) & 0xff,
  ])
}

test.describe("Adversarial audit follow-ups & low-level rollback invariants", () => {
  const originalFetch = globalThis.fetch
  const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL
  const originalMaxBodyBytes = process.env.BACKEND_PROXY_MAX_BODY_BYTES
  const originalMaxInFlightBytes = process.env.BACKEND_PROXY_MAX_IN_FLIGHT_BODY_BYTES

  test.afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBackendInternalUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl
    if (originalMaxBodyBytes === undefined) delete process.env.BACKEND_PROXY_MAX_BODY_BYTES
    else process.env.BACKEND_PROXY_MAX_BODY_BYTES = originalMaxBodyBytes
    if (originalMaxInFlightBytes === undefined) delete process.env.BACKEND_PROXY_MAX_IN_FLIGHT_BODY_BYTES
    else process.env.BACKEND_PROXY_MAX_IN_FLIGHT_BODY_BYTES = originalMaxInFlightBytes
    invalidateServerSnapshotCache()
  })

  test("[BLOCKING 1] backend proxy avoids deadlock on early downstream destroy/close, releases inFlightProxyBodyBytes, and avoids ERR_HTTP_HEADERS_SENT", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend.internal"
    process.env.BACKEND_PROXY_MAX_BODY_BYTES = String(8 * 1024 * 1024)
    process.env.BACKEND_PROXY_MAX_IN_FLIGHT_BODY_BYTES = String(8 * 1024 * 1024)

    const bodyChunkSize = 6 * 1024 * 1024 // 6 MiB out of 8 MiB capacity; any single leak causes next 6 MiB upload to 503!

    const createUploadReq = () =>
      Object.assign(Readable.from([Buffer.from("small-payload")]), {
        method: "POST",
        headers: {
          host: "blog.aquilaxk.site",
          "content-type": "application/octet-stream",
          "content-length": String(bodyChunkSize),
        },
        query: { path: ["post", "api", "v1", "posts"] },
        url: "/api/backend/post/api/v1/posts",
        socket: { remoteAddress: "127.0.0.1" },
      })

    const runWithDeadlockGuard = async (promise: Promise<unknown>, label: string) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Deadlock detected: ${label}`)), 500)
          }),
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    // 1a. Synchronous destroy() inside res.write() returning false (close already emitted before backpressure Promise)
    let upstreamCancelledSync = false
    globalThis.fetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]))
        },
        cancel() {
          upstreamCancelledSync = true
        },
      })
      return new Response(stream, { status: 200 })
    }) as typeof fetch

    const syncEmitter = new EventEmitter()
    const resSyncDestroy = Object.assign(syncEmitter, {
      destroyed: false,
      closed: false,
      writableEnded: false,
      headersSent: false,
      status() {
        return this
      },
      setHeader() {
        return this
      },
      destroy() {
        this.destroyed = true
        this.closed = true
        syncEmitter.emit("close")
        return this
      },
      write() {
        this.headersSent = true
        this.destroy()
        return false
      },
      end() {
        this.writableEnded = true
        return this
      },
      json(body: unknown) {
        return body
      },
    })

    await runWithDeadlockGuard(
      backendProxyHandler(createUploadReq() as never, resSyncDestroy as never),
      "sync destroy inside res.write"
    )
    expect(upstreamCancelledSync).toBe(true)

    // 1b. Async error event during backpressure wait
    let upstreamCancelledAsyncErr = false
    globalThis.fetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([5, 6, 7, 8]))
        },
        cancel() {
          upstreamCancelledAsyncErr = true
        },
      })
      return new Response(stream, { status: 200 })
    }) as typeof fetch

    const asyncErrEmitter = new EventEmitter()
    const resAsyncError = Object.assign(asyncErrEmitter, {
      destroyed: false,
      closed: false,
      writableEnded: false,
      headersSent: false,
      status() {
        return this
      },
      setHeader() {
        return this
      },
      destroy() {
        this.destroyed = true
        this.closed = true
        return this
      },
      write() {
        this.headersSent = true
        setTimeout(() => {
          this.destroyed = true
          this.closed = true
          asyncErrEmitter.emit("error", new Error("ECONNRESET"))
        }, 10)
        return false
      },
      end() {
        this.writableEnded = true
        return this
      },
      json(body: unknown) {
        return body
      },
    })

    await runWithDeadlockGuard(
      backendProxyHandler(createUploadReq() as never, resAsyncError as never),
      "async error during backpressure"
    )
    expect(upstreamCancelledAsyncErr).toBe(true)

    // 1c. Upstream stream throws AFTER headersSent = true -> must NOT throw ERR_HTTP_HEADERS_SENT, must destroy res and release capacity
    let pullCount = 0
    globalThis.fetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pullCount += 1
          if (pullCount === 1) {
            controller.enqueue(new Uint8Array([9, 10]))
            return
          }
          throw new Error("upstream mid-stream reset")
        },
      })
      return new Response(stream, { status: 200 })
    }) as typeof fetch

    let destroyCalledOnMidStreamError = false
    const resHeadersAlreadySent = Object.assign(new EventEmitter(), {
      destroyed: false,
      closed: false,
      writableEnded: false,
      headersSent: false,
      status() {
        if (this.headersSent) {
          throw Object.assign(new Error("Cannot set headers after they are sent to the client"), {
            code: "ERR_HTTP_HEADERS_SENT",
          })
        }
        return this
      },
      setHeader() {
        if (this.headersSent) {
          throw Object.assign(new Error("Cannot set headers after they are sent to the client"), {
            code: "ERR_HTTP_HEADERS_SENT",
          })
        }
        return this
      },
      destroy() {
        destroyCalledOnMidStreamError = true
        this.destroyed = true
        this.closed = true
        return this
      },
      write() {
        this.headersSent = true
        return true
      },
      end() {
        this.writableEnded = true
        return this
      },
      json() {
        if (this.headersSent) {
          throw Object.assign(new Error("Cannot set headers after they are sent to the client"), {
            code: "ERR_HTTP_HEADERS_SENT",
          })
        }
        return this
      },
    })

    await expect(
      backendProxyHandler(createUploadReq() as never, resHeadersAlreadySent as never)
    ).resolves.toBeUndefined()
    expect(destroyCalledOnMidStreamError).toBe(true)

    // 1d. Prove zero capacity leak: another 6 MiB upload succeeds with 200 instead of 503!
    globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch
    let finalStatus = 0
    const resHealthy = Object.assign(new EventEmitter(), {
      destroyed: false,
      closed: false,
      writableEnded: false,
      headersSent: false,
      status(code: number) {
        finalStatus = code
        return this
      },
      setHeader() {
        return this
      },
      write() {
        this.headersSent = true
        return true
      },
      end() {
        this.writableEnded = true
        return this
      },
      json(body: unknown) {
        return body
      },
    })

    await backendProxyHandler(createUploadReq() as never, resHealthy as never)
    expect(finalStatus).toBe(200)
  })

  test("[BLOCKING 2] WebP/JPEG header prober rejects malformed/truncated headers & 65KB-padded JPEG bombs while allowing 70KB Exif JPEGs", async () => {
    // 2a. Valid WebP VP8 / VP8X return required numeric width & height; malformed/truncated WebP chunks fail closed
    expect(probeImageHeaderFromBytes(makeWebpVp8Header(640, 360), "image/webp")).toEqual({
      format: "webp",
      width: 640,
      height: 360,
      isOpaque: true,
    })
    expect(probeImageHeaderFromBytes(makeWebpVp8xHeader(1024, 768, true), "image/webp")).toEqual({
      format: "webp",
      width: 1024,
      height: 768,
      isOpaque: false,
    })

    const truncatedVp8 = makeWebpVp8Header(640, 360).subarray(0, 26)
    const badStartCodeVp8 = makeWebpVp8Header(640, 360)
    badStartCodeVp8[23] = 0x00
    const truncatedVp8l = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c,
      0x05, 0x00, 0x00, 0x00,
      0x2f, 0x00,
    ])
    const badSigVp8l = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c,
      0x05, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x02, 0x03, 0x04,
    ])
    const truncatedVp8x = makeWebpVp8xHeader(500, 500).subarray(0, 25)

    for (const malformedWebp of [
      truncatedVp8,
      badStartCodeVp8,
      truncatedVp8l,
      badSigVp8l,
      truncatedVp8x,
    ]) {
      expect(() => probeImageHeaderFromBytes(malformedWebp, "image/webp")).toThrow()
      await expect(
        readAndProbeImageFileHeader(toBytesFile(malformedWebp, "bad.webp", "image/webp"), "image/webp")
      ).rejects.toThrow()
    }

    // Corrupted JPEG: segmentLength < 2, SOS before SOF, EOI before SOF
    const badSegLenJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00])
    const sosBeforeSofJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0, 0, 0, 0, 0, 0])
    const eoiBeforeSofJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    for (const badJpeg of [badSegLenJpeg, sosBeforeSofJpeg, eoiBeforeSofJpeg]) {
      expect(() => probeImageHeaderFromBytes(badJpeg, "image/jpeg")).toThrow()
      await expect(
        readAndProbeImageFileHeader(toBytesFile(badJpeg, "bad.jpg", "image/jpeg"), "image/jpeg")
      ).rejects.toThrow()
    }

    // 2b. 65KB COM (0xFE) & APP1 (0xE1) segments pushing 30000x30000 SOF0 past initial 64KB probe buffer -> MUST reject!
    const soi = new Uint8Array([0xff, 0xd8])
    const eoi = new Uint8Array([0xff, 0xd9])
    const padded65kCom = makeJpegSegment(0xfe, new Uint8Array(65_530).fill(0x41))
    const padded65kApp1 = makeJpegSegment(0xe1, new Uint8Array(65_530).fill(0x45))
    const bombSof0 = makeJpegSof0Segment(30_000, 30_000)

    const comBombBytes = concatBytes([soi, padded65kCom, bombSof0, eoi])
    const app1BombBytes = concatBytes([soi, padded65kApp1, bombSof0, eoi])
    await expect(
      readAndProbeImageFileHeader(toBytesFile(comBombBytes, "com-bomb.jpg", "image/jpeg"), "image/jpeg")
    ).rejects.toThrow("이미지 해상도가 허용 범위를 초과했습니다")
    await expect(
      readAndProbeImageFileHeader(toBytesFile(app1BombBytes, "app1-bomb.jpg", "image/jpeg"), "image/jpeg")
    ).rejects.toThrow("이미지 해상도가 허용 범위를 초과했습니다")

    // Exceeding 256-segment budget before SOF0 also fails closed
    const manyTinySegments: Uint8Array[] = [soi]
    for (let i = 0; i < 260; i += 1) {
      manyTinySegments.push(makeJpegSegment(0xfe, new Uint8Array([0x30, 0x31])))
    }
    manyTinySegments.push(makeJpegSof0Segment(400, 300), eoi)
    await expect(
      readAndProbeImageFileHeader(
        toBytesFile(concatBytes(manyTinySegments), "too-many-segs.jpg", "image/jpeg"),
        "image/jpeg"
      )
    ).rejects.toThrow()

    // 2c. 70KB normal Exif APP1 segment (two 36KB APP1 chunks = 72KB > 65_536B) followed by valid 1200x800 SOF0 -> MUST pass!
    const exifChunkA = makeJpegSegment(0xe1, new Uint8Array(36_864).fill(0x11))
    const exifChunkB = makeJpegSegment(0xe2, new Uint8Array(36_864).fill(0x22))
    const validSof0 = makeJpegSof0Segment(1200, 800)
    const validLargeExifJpeg = concatBytes([soi, exifChunkA, exifChunkB, validSof0, eoi])
    await expect(
      readAndProbeImageFileHeader(
        toBytesFile(validLargeExifJpeg, "camera-exif.jpg", "image/jpeg"),
        "image/jpeg"
      )
    ).resolves.toEqual({
      format: "jpeg",
      width: 1200,
      height: 800,
      isOpaque: true,
    })

    // 2d. Defense-in-depth in profileImageUpload.ts: container header claims 100x100 while decoded Image reports 10000x10000
    const prevImage = (globalThis as { Image?: unknown }).Image
    const prevDocument = (globalThis as { document?: unknown }).document
    const prevCreateObjectURL = URL.createObjectURL
    const prevRevokeObjectURL = URL.revokeObjectURL
    let canvasCreated = false
    URL.createObjectURL = () => "blob:mock-image"
    URL.revokeObjectURL = () => undefined
    ;(globalThis as { document?: unknown }).document = {
      createElement() {
        canvasCreated = true
        throw new Error("canvas must not be allocated for oversized decoded image")
      },
    }
    ;(globalThis as { Image?: unknown }).Image = class MockOversizedDecodedImage {
      naturalWidth = 10_000
      naturalHeight = 10_000
      width = 10_000
      height = 10_000
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }

    try {
      const disguisedWebpFile = toBytesFile(makeWebpVp8xHeader(100, 100), "disguised.webp", "image/webp")
      await expect(preparePostImageForUpload(disguisedWebpFile)).rejects.toThrow(
        "이미지 해상도가 허용 범위를 초과했습니다"
      )
      await expect(
        buildProfileImageEditedFile(disguisedWebpFile, { focusX: 50, focusY: 50, zoom: 1 })
      ).rejects.toThrow("이미지 해상도가 허용 범위를 초과했습니다")
      expect(canvasCreated).toBe(false)
    } finally {
      URL.createObjectURL = prevCreateObjectURL
      URL.revokeObjectURL = prevRevokeObjectURL
      if (prevDocument === undefined) delete (globalThis as { document?: unknown }).document
      else (globalThis as { document?: unknown }).document = prevDocument
      if (prevImage === undefined) delete (globalThis as { Image?: unknown }).Image
      else (globalThis as { Image?: unknown }).Image = prevImage
    }
  })

  test("[BLOCKING 3] rolling back unclosed <aside> and nested unclosed :::::callout restores lineMasks accurately", () => {
    // 3a. Unclosed <aside> + blank line + 4-space indented code block containing $$ and $1 + $2
    const unclosedAsideWithIndentedCode = [
      "<aside>",
      "",
      "    $$",
      "    const total = $1 + $2",
      "    $$",
    ].join("\n")

    const codeRanges = collectCommonMarkCodeBlockRanges(unclosedAsideWithIndentedCode)
    const expectedCodeStart = "<aside>\n\n".length
    expect(codeRanges).toEqual([
      {
        from: expectedCodeStart,
        to: unclosedAsideWithIndentedCode.length,
      },
    ])
    expect(escapeNonPandocSingleDollars(unclosedAsideWithIndentedCode)).toBe(
      unclosedAsideWithIndentedCode
    )

    const asideMasks = inspectCommonMarkLineMasks(unclosedAsideWithIndentedCode)
    expect(asideMasks[0]! & LINE_BIT_CONTAINER).toBe(0)
    expect(asideMasks[2]! & LINE_BIT_MATH).toBe(0)
    expect(asideMasks[3]! & LINE_BIT_MATH).toBe(0)
    expect(asideMasks[3]! & LINE_BIT_INDENTED_CODE).toBe(LINE_BIT_INDENTED_CODE)

    // Pre-blank fence inside unclosed <aside> still keeps LINE_BIT_CONTAINER on pre-blank lines
    const unclosedAsideWithPreBlankFence = ["<aside>", "```ts", "", "    const v = $1 + $2"].join("\n")
    const preBlankMasks = inspectCommonMarkLineMasks(unclosedAsideWithPreBlankFence)
    expect(preBlankMasks[0]! & LINE_BIT_CONTAINER).toBe(LINE_BIT_CONTAINER)
    expect(preBlankMasks[1]! & LINE_BIT_CONTAINER).toBe(LINE_BIT_CONTAINER)
    expect(escapeNonPandocSingleDollars(unclosedAsideWithPreBlankFence)).toBe(
      unclosedAsideWithPreBlankFence
    )

    // 3b. Closed outer ::::toggle containing an unclosed inner :::::callout (and outer bounded $$ formula)
    const nestedUnclosedCalloutDoc = [
      "::::toggle Outer toggle",
      ":::::callout info Unclosed inner callout",
      "Body text",
      "$$",
      "a + b = c",
      "$$",
      "::::",
    ].join("\n")

    const nestedMasks = inspectCommonMarkLineMasks(nestedUnclosedCalloutDoc)
    expect(nestedMasks[0]! & LINE_BIT_CONTAINER).toBe(LINE_BIT_CONTAINER)
    expect(nestedMasks[1]! & LINE_BIT_CONTAINER).toBe(0)
    expect(nestedMasks[3]! & LINE_BIT_MATH).toBe(LINE_BIT_MATH)
    expect(nestedMasks[4]! & LINE_BIT_MATH).toBe(LINE_BIT_MATH)
    expect(nestedMasks[5]! & LINE_BIT_MATH).toBe(LINE_BIT_MATH)
    expect(nestedMasks[6]! & LINE_BIT_CONTAINER).toBe(LINE_BIT_CONTAINER)

    const nestedRanges = parseCommonMarkBlockRanges(nestedUnclosedCalloutDoc)
    expect(nestedRanges.containerCloseRanges).toHaveLength(1)
  })

  test("[Enhancement 1] serverSnapshotCache generation counter prevents stale in-flight load from overwriting post-invalidation cache or deleting new in-flight load", async () => {
    const createDeferred = <T,>() => {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((res) => {
        resolve = res
      })
      return { promise, resolve }
    }

    // Race A: pre-invalidation load resolves WHILE post-invalidation load is still in-flight
    const staleDeferredA = createDeferred<{ gen: string }>()
    const freshDeferredA = createDeferred<{ gen: string }>()
    let loaderCallsA = 0

    const staleCallA = readServerSnapshot("admin:posts:gen-race-a", 60_000, () => {
      loaderCallsA += 1
      return staleDeferredA.promise
    })

    invalidateServerSnapshotCache()

    const freshCallA1 = readServerSnapshot("admin:posts:gen-race-a", 60_000, () => {
      loaderCallsA += 1
      return freshDeferredA.promise
    })

    // Stale load finishes first; its finally MUST NOT delete freshDeferredA from inflightLoads!
    staleDeferredA.resolve({ gen: "stale-0" })
    await expect(staleCallA).resolves.toEqual({ value: { gen: "stale-0" }, source: "live" })

    const freshCallA2 = readServerSnapshot("admin:posts:gen-race-a", 60_000, async () => {
      loaderCallsA += 1
      return { gen: "unexpected-duplicate-load" }
    })
    expect(loaderCallsA).toBe(2)

    freshDeferredA.resolve({ gen: "fresh-1" })
    await expect(freshCallA1).resolves.toEqual({ value: { gen: "fresh-1" }, source: "live" })
    await expect(freshCallA2).resolves.toEqual({ value: { gen: "fresh-1" }, source: "snapshot" })

    // Race B: post-invalidation load finishes FIRST and caches fresh value, THEN pre-invalidation load finishes late
    const staleDeferredB = createDeferred<{ gen: string }>()
    const staleCallB = readServerSnapshot("admin:posts:gen-race-b", 60_000, () => staleDeferredB.promise)

    invalidateServerSnapshotCache("admin:posts:")

    const freshCallB = await readServerSnapshot("admin:posts:gen-race-b", 60_000, async () => ({
      gen: "fresh-2",
    }))
    expect(freshCallB).toEqual({ value: { gen: "fresh-2" }, source: "live" })

    // Late stale completion MUST NOT overwrite "fresh-2" in snapshotCache!
    staleDeferredB.resolve({ gen: "stale-1" })
    await expect(staleCallB).resolves.toEqual({ value: { gen: "stale-1" }, source: "live" })

    const cachedAfterStale = await readServerSnapshot("admin:posts:gen-race-b", 60_000, async () => ({
      gen: "should-not-run",
    }))
    expect(cachedAfterStale).toEqual({ value: { gen: "fresh-2" }, source: "snapshot" })
  })
})
