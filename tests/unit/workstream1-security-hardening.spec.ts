import { EventEmitter } from "node:events"
import { PassThrough, Readable } from "node:stream"
import vm from "node:vm"
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib"
import { expect, test } from "@playwright/test"
import type { NextApiRequest, NextApiResponse } from "next"
const { CLIENT_RUNTIME_RECOVERY_SCRIPT } = require("../../src/libs/security/documentInlineScripts")
import { clearFeedExplorerRestoreCache } from "../../src/libs/feed/feedRestoreCache"
import { extractUnfurlMetadata, resolveEmbedPreviewUrl } from "../../src/libs/unfurl/extractMeta"
import {
  decodeUnfurlResponseBuffer,
  isPrivateIpv6,
  MAX_UNFURL_RESPONSE_BYTES,
  parseIpv6Words,
  readBoundedIncomingResponse,
  UnfurlResponseTooLargeError,
} from "../../src/libs/unfurl/requestSafety"
import { normalizePublicExternalThumbnailUrl } from "../../src/libs/markdown/externalThumbnailUrlPolicy"
import {
  resolveMarkdownAttachmentLink,
  validateMarkdownAttachmentSize,
} from "../../src/components/markdown-editor/markdownEditorUploadModel"
import { isImageFile } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import backendProxyHandler from "../../src/pages/api/backend/[...path]"
import revalidateHandler from "../../src/pages/api/revalidate"
import unfurlHandler from "../../src/pages/api/editor/unfurl"
import { getStaticProps as getHomeStaticProps } from "../../src/pages/index"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import {
  invalidateServerSnapshotCache,
  readServerSnapshot,
} from "../../src/libs/server/serverSnapshotCache"
import { resetPostsRequestCaches } from "../../src/apis/backend/posts/PostApiRequests"
import { normalizeContentHtmlForMermaid } from "../../src/libs/markdown/renderingHtmlModel"
import {
  ensureFileIsUploadable,
  hasAlphaTransparency,
} from "../../src/libs/profileImageUpload"
import { probeImageHeaderFromBytes } from "../../src/libs/imageUploadHeaderProbe"

const makePngHeader = (width: number, height: number, colorType: number, withTrns = false): Uint8Array => {
  const chunks: number[] = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, // IHDR
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    8, colorType, 0, 0, 0,
    0, 0, 0, 0, // CRC placeholder
  ]
  if (withTrns) {
    chunks.push(
      0x00, 0x00, 0x00, 0x06,
      0x74, 0x52, 0x4e, 0x53, // tRNS
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
    )
  }
  chunks.push(0x00, 0x00, 0x00, 0x00, 0x49, 0x44, 0x41, 0x54, 0, 0, 0, 0)
  return new Uint8Array(chunks)
}

const makeJpegHeader = (width: number, height: number): Uint8Array =>
  new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0,
    0x00, 0x11, 0x08,
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ])

const makeGifHeader = (width: number, height: number): Uint8Array =>
  new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    width & 0xff, (width >>> 8) & 0xff,
    height & 0xff, (height >>> 8) & 0xff,
  ])

const makeWebpVp8lHeader = (width: number, height: number, alpha: boolean): Uint8Array => {
  const wBits = (width - 1) & 0x3fff
  const hBits = ((height - 1) & 0x3fff) << 14
  const aBit = alpha ? (1 << 28) : 0
  const packed = (wBits | hBits | aBit) >>> 0
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4c, // VP8L
    0x0a, 0x00, 0x00, 0x00,
    0x2f,
    packed & 0xff, (packed >>> 8) & 0xff, (packed >>> 16) & 0xff, (packed >>> 24) & 0xff,
  ])
}

test.describe("Workstream 1 adversarial security hardening", () => {
  const originalFetch = globalThis.fetch
  const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL
  const originalRevalidateToken = process.env.TOKEN_FOR_REVALIDATE
  const originalEnableQaRoutes = process.env.ENABLE_QA_ROUTES
  const originalQaBypass = process.env.ADMIN_GUARD_QA_BYPASS

  test.afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBackendInternalUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl
    if (originalRevalidateToken === undefined) delete process.env.TOKEN_FOR_REVALIDATE
    else process.env.TOKEN_FOR_REVALIDATE = originalRevalidateToken
    if (originalEnableQaRoutes === undefined) delete process.env.ENABLE_QA_ROUTES
    else process.env.ENABLE_QA_ROUTES = originalEnableQaRoutes
    if (originalQaBypass === undefined) delete process.env.ADMIN_GUARD_QA_BYPASS
    else process.env.ADMIN_GUARD_QA_BYPASS = originalQaBypass
    invalidateServerSnapshotCache()
    resetPostsRequestCaches()
  })

  test("unfurl enforces 262_144B raw/decompressed limits, skips 3xx bodies via resume(), and parses full IPv6 bitmasks", async () => {
    expect(MAX_UNFURL_RESPONSE_BYTES).toBe(262_144)

    const bombPayload = Buffer.alloc(MAX_UNFURL_RESPONSE_BYTES + 8192, 0x41)
    expect(() => decodeUnfurlResponseBuffer(gzipSync(bombPayload), "gzip")).toThrow()
    expect(() => decodeUnfurlResponseBuffer(deflateSync(bombPayload), "deflate")).toThrow()
    expect(() => decodeUnfurlResponseBuffer(brotliCompressSync(bombPayload), "br")).toThrow()

    const safeText = Buffer.from("<html><title>ok</title></html>")
    expect(decodeUnfurlResponseBuffer(gzipSync(safeText), "gzip").toString("utf8")).toBe(safeText.toString("utf8"))

    // Stream byte limit & upstream destroy
    const oversizedStream = new PassThrough() as PassThrough & {
      statusCode: number
      headers: Record<string, string>
    }
    oversizedStream.statusCode = 200
    oversizedStream.headers = { "content-type": "text/html" }
    let aborted = false
    let destroyed = false
    const origDestroy = oversizedStream.destroy.bind(oversizedStream)
    oversizedStream.destroy = ((err?: Error) => {
      destroyed = true
      return origDestroy(err)
    }) as typeof oversizedStream.destroy

    const streamPromise = readBoundedIncomingResponse(oversizedStream, () => {
      aborted = true
    })
    oversizedStream.write(Buffer.alloc(200_000, 0x61))
    oversizedStream.write(Buffer.alloc(70_000, 0x62))
    await expect(streamPromise).rejects.toBeInstanceOf(UnfurlResponseTooLargeError)
    expect(destroyed).toBe(true)
    expect(aborted).toBe(true)

    // 3xx redirect calls resume() without reading body
    const redirectStream = new PassThrough() as PassThrough & {
      statusCode: number
      headers: Record<string, string>
    }
    redirectStream.statusCode = 302
    redirectStream.headers = { location: "https://github.com/other" }
    let resumed = false
    const origResume = redirectStream.resume.bind(redirectStream)
    redirectStream.resume = (() => {
      resumed = true
      return origResume()
    }) as typeof redirectStream.resume
    const redirectResp = await readBoundedIncomingResponse(redirectStream)
    expect(resumed).toBe(true)
    expect(redirectResp.status).toBe(302)
    expect(await redirectResp.text()).toBe("")

    // IPv6 Uint16Array(8) bitmask validation
    expect(Array.from(parseIpv6Words("2606:4700:4700::1111") ?? [])).toEqual([
      0x2606, 0x4700, 0x4700, 0, 0, 0, 0, 0x1111,
    ])
    for (const blocked of [
      "::",
      "::1",
      "0:0:0:0:0:0:0:1",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "fe80::1%eth0",
      "ff02::1",
      "64:ff9b::127.0.0.1",
      "64:ff9b:1::1",
      "2001::1",
      "2002:7f00:0001::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:0001",
      "::ffff:10.0.0.1",
      "::ffff:169.254.169.254",
      "not-valid-ipv6",
    ]) {
      expect(isPrivateIpv6(blocked), `expected private/blocked for ${blocked}`).toBe(true)
    }
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false)
    expect(isPrivateIpv6("::ffff:1.1.1.1")).toBe(false)
  })

  test("unfurl API masks internal upstream errors on 504", async () => {
    process.env.ADMIN_GUARD_QA_BYPASS = "true"
    process.env.ENABLE_QA_ROUTES = "false"
    let statusCode = 200
    let body: unknown = null
    const res = {
      status(code: number) {
        statusCode = code
        return this
      },
      setHeader() {
        return this
      },
      json(data: unknown) {
        body = data
        return this
      },
    } as unknown as NextApiResponse
    // Non-existent subdomain triggers real internal DNS/fetch error inside inner try
    await unfurlHandler(
      {
        method: "GET",
        headers: {},
        query: { url: "https://nonexistent.invalid.github.com/test" },
      } as unknown as NextApiRequest,
      res
    )
    expect(statusCode).toBe(504)
    expect(body).toEqual({
      ok: false,
      message: "링크 메타데이터를 불러오지 못했습니다.",
    })
  })

  test("CLIENT_RUNTIME_RECOVERY_SCRIPT fails closed when sessionStorage throws SecurityError and reloads at most once when writable", () => {
    const createSandbox = (storageMode: "throws" | "working") => {
      const listeners = new Map<string, Array<(event: unknown) => void>>()
      const store = new Map<string, string>()
      let reloadCount = 0

      const sessionStorage =
        storageMode === "throws"
          ? {
              getItem() {
                throw new Error("SecurityError: access denied")
              },
              setItem() {
                throw new Error("SecurityError: access denied")
              },
            }
          : {
              getItem(key: string) {
                return store.has(key) ? store.get(key)! : null
              },
              setItem(key: string, value: string) {
                store.set(key, value)
              },
            }

      const sandboxWindow = {
        location: {
          pathname: "/posts/1",
          reload() {
            reloadCount += 1
          },
        },
        sessionStorage,
        addEventListener(type: string, handler: (event: unknown) => void) {
          const list = listeners.get(type) ?? []
          list.push(handler)
          listeners.set(type, list)
        },
      }
      const sandboxDocument = {
        documentElement: {
          dataset: { assetVersion: "v-test" },
        },
      }
      function HTMLScriptElement() {}
      function HTMLLinkElement() {}

      vm.runInNewContext(CLIENT_RUNTIME_RECOVERY_SCRIPT, {
        window: sandboxWindow,
        document: sandboxDocument,
        sessionStorage,
        HTMLScriptElement,
        HTMLLinkElement,
      })

      const triggerChunkError = () => {
        for (const handler of listeners.get("error") ?? []) {
          handler({ message: "Hydration failed because initial UI did not match" })
        }
      }

      return { triggerChunkError, getReloadCount: () => reloadCount }
    }

    const blockedSandbox = createSandbox("throws")
    blockedSandbox.triggerChunkError()
    blockedSandbox.triggerChunkError()
    expect(blockedSandbox.getReloadCount()).toBe(0)

    const workingSandbox = createSandbox("working")
    workingSandbox.triggerChunkError()
    workingSandbox.triggerChunkError()
    expect(workingSandbox.getReloadCount()).toBe(1)
  })

  test("clearFeedExplorerRestoreCache swallows SecurityError when sessionStorage access throws", () => {
    const previousWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {
      sessionStorage: {
        get length() {
          throw new Error("SecurityError")
        },
        key() {
          throw new Error("SecurityError")
        },
        removeItem() {
          throw new Error("SecurityError")
        },
      },
    }
    try {
      expect(() => clearFeedExplorerRestoreCache()).not.toThrow()
    } finally {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = previousWindow
    }
  })

  test("extractUnfurlMetadata parses attribute-order-independent meta tags and filters unsafe thumbnails and embed IDs", () => {
    const html = [
      '<html><head>',
      '<meta content="Reversed Attribute Title" property="og:title">',
      '<meta content="Reversed Description" name="twitter:description">',
      '<meta content="https://cdn.example.test/og-thumb.png" property="og:image">',
      '</head></html>',
    ].join("")

    const parsed = extractUnfurlMetadata("https://github.com/aquilaxk/aquila-blog", html)
    expect(parsed.title).toBe("Reversed Attribute Title")
    expect(parsed.description).toBe("Reversed Description")
    expect(parsed.thumbnailUrl).toBe("https://cdn.example.test/og-thumb.png")

    expect(extractUnfurlMetadata("https://github.com/a/b", '<meta content="http://127.0.0.1:8080/internal.png" property="og:image">').thumbnailUrl).toBe("")
    expect(extractUnfurlMetadata("https://github.com/a/b", '<meta content="http://169.254.169.254/latest" property="og:image">').thumbnailUrl).toBe("")
    expect(extractUnfurlMetadata("https://github.com/a/b", '<meta content="javascript:alert(1)" property="og:image">').thumbnailUrl).toBe("")
    expect(extractUnfurlMetadata("https://github.com/a/b", '<meta content="https://user:pass@cdn.example.test/a.png" property="og:image">').thumbnailUrl).toBe("")

    expect(normalizePublicExternalThumbnailUrl("https://images.example.com/card.webp")).toBe("https://images.example.com/card.webp")
    expect(normalizePublicExternalThumbnailUrl("http://localhost:3000/a.png")).toBe("")
    expect(normalizePublicExternalThumbnailUrl("http://[::1]/a.png")).toBe("")

    expect(resolveEmbedPreviewUrl("https://youtu.be/../../evil")).toBe("")
    expect(resolveEmbedPreviewUrl("https://vimeo.com/12345/../../evil")).toBe("")
    expect(resolveEmbedPreviewUrl("https://youtu.be/x")).toBe("")
    expect(resolveEmbedPreviewUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ")
  })

  test("backend proxy unwraps error.cause chain for ProxyBodyTooLargeError (413) and streams slices with drain backpressure", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend.internal"

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      try {
        const reader = (init?.body as ReadableStream<Uint8Array>).getReader()
        while (true) {
          const step = await reader.read()
          if (step.done) break
        }
      } catch (streamError) {
        throw new TypeError("fetch failed", { cause: streamError })
      }
      return new Response("ok", { status: 200 })
    }) as typeof fetch

    const reqOversized = Object.assign(
      Readable.from([Buffer.alloc(600 * 1024, 0x41), Buffer.alloc(600 * 1024, 0x42)]),
      {
        method: "POST",
        headers: { host: "blog.aquilaxk.site", "transfer-encoding": "chunked" },
        query: { path: ["post", "api", "v1", "posts"] },
        url: "/api/backend/post/api/v1/posts",
        socket: { remoteAddress: "127.0.0.1" },
      }
    )

    let statusCode = 200
    let jsonBody: unknown = null
    const mockResOversized = Object.assign(new EventEmitter(), {
      status(code: number) {
        statusCode = code
        return this
      },
      setHeader() {
        return this
      },
      write() {
        return true
      },
      end() {
        return this
      },
      json(body: unknown) {
        jsonBody = body
        return body
      },
    })

    await backendProxyHandler(reqOversized as never, mockResOversized as never)
    expect(statusCode).toBe(413)
    expect(jsonBody).toMatchObject({ message: expect.stringContaining("파일 용량이 너무 큽니다") })

    const backing = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55])
    const subview = backing.subarray(2, 5)
    let chunkIndex = 0
    globalThis.fetch = (async () => {
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkIndex === 0) {
            chunkIndex += 1
            controller.enqueue(subview)
          } else {
            controller.close()
          }
        },
      })
      return new Response(body, { status: 200 })
    }) as typeof fetch

    const reqGet = Object.assign(new EventEmitter(), {
      method: "GET",
      headers: { host: "blog.aquilaxk.site" },
      query: { path: ["post", "api", "v1", "posts"] },
      url: "/api/backend/post/api/v1/posts",
      socket: { remoteAddress: "127.0.0.1" },
    })

    const writtenChunks: Buffer[] = []
    let drainTriggered = false
    let resEnded = false
    const mockResDrain = Object.assign(new EventEmitter(), {
      status() {
        return this
      },
      setHeader() {
        return this
      },
      write(chunk: Buffer) {
        writtenChunks.push(Buffer.from(chunk))
        setTimeout(() => {
          drainTriggered = true
          mockResDrain.emit("drain")
        }, 10)
        return false
      },
      end() {
        resEnded = true
        return this
      },
      json(body: unknown) {
        return body
      },
    })

    await backendProxyHandler(reqGet as never, mockResDrain as never)
    expect(drainTriggered).toBe(true)
    expect(resEnded).toBe(true)
    expect(Buffer.concat(writtenChunks)).toEqual(Buffer.from([0x22, 0x33, 0x44]))
  })

  test("markdown attachment validation rejects dangerous extensions, MIME types, and unsafe uploaded URLs", () => {
    for (const badFile of [
      new File(["<html/>"], "doc.html", { type: "text/html" }),
      new File(["<htm/>"], "doc.htm", { type: "application/octet-stream" }),
      new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" }),
      new File(["alert(1)"], "script.js", { type: "application/javascript" }),
      new File(["export {}"], "mod.mjs", { type: "text/javascript" }),
      new File(["<html/>"], "doc.xhtml", { type: "application/xhtml+xml" }),
    ]) {
      expect(validateMarkdownAttachmentSize(badFile), `expected rejection for ${badFile.name}`).toBeTruthy()
    }
    expect(isImageFile(new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" }))).toBe(false)

    for (const badUrl of [
      "javascript:alert(1)",
      "https://user:pass@cdn.example.test/spec.pdf",
      "https://cdn.example.test/payload.html",
      "https://cdn.example.test/payload.svg?download=1",
      "https://cdn.example.test/payload.js",
      "https://cdn.example.test/payload.xhtml",
    ]) {
      const result = resolveMarkdownAttachmentLink({ url: badUrl, name: "file.txt" }, "file.txt")
      expect("error" in result, `expected error for ${badUrl}`).toBe(true)
    }
  })

  test("image upload probes 64KB magic bytes/dimensions fail-closed, skips opaque headers, and handles Uint32Array unaligned alpha checks", () => {
    expect(() => ensureFileIsUploadable(new File(["x"], "avatar.png", { type: "text/html" }), "profile")).toThrow()
    expect(() => ensureFileIsUploadable(new File(["x"], "avatar.html", { type: "image/png" }), "profile")).toThrow()

    expect(probeImageHeaderFromBytes(makePngHeader(640, 480, 2, false), "image/png")).toEqual({
      format: "png",
      width: 640,
      height: 480,
      isOpaque: true,
    })
    expect(probeImageHeaderFromBytes(makePngHeader(640, 480, 2, true), "image/png").isOpaque).toBe(false)
    expect(probeImageHeaderFromBytes(makePngHeader(640, 480, 6, false), "image/png").isOpaque).toBe(false)
    expect(() => probeImageHeaderFromBytes(makePngHeader(9000, 100, 2), "image/png")).toThrow()
    expect(() => probeImageHeaderFromBytes(makePngHeader(6000, 6000, 2), "image/png")).toThrow()

    expect(probeImageHeaderFromBytes(makeJpegHeader(1200, 800), "image/jpeg")).toEqual({
      format: "jpeg",
      width: 1200,
      height: 800,
      isOpaque: true,
    })
    expect(() => probeImageHeaderFromBytes(makeJpegHeader(8193, 100), "image/jpeg")).toThrow()

    expect(probeImageHeaderFromBytes(makeGifHeader(320, 240), "image/gif")).toEqual({
      format: "gif",
      width: 320,
      height: 240,
      isOpaque: false,
    })
    expect(() => probeImageHeaderFromBytes(makeGifHeader(8500, 240), "image/gif")).toThrow()

    expect(probeImageHeaderFromBytes(makeWebpVp8lHeader(800, 600, false), "image/webp")).toEqual({
      format: "webp",
      width: 800,
      height: 600,
      isOpaque: true,
    })
    expect(probeImageHeaderFromBytes(makeWebpVp8lHeader(800, 600, true), "image/webp").isOpaque).toBe(false)

    // Polyglot / mismatched MIME
    expect(() => probeImageHeaderFromBytes(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/png")).toThrow()
    expect(() => probeImageHeaderFromBytes(makeJpegHeader(100, 100), "image/png")).toThrow()

    const unalignedBacking = new Uint8ClampedArray(1 + 4 * 9).fill(255)
    const unalignedOpaque = new Uint8ClampedArray(unalignedBacking.buffer, 1, 4 * 9)
    expect(hasAlphaTransparency(unalignedOpaque)).toBe(false)
    unalignedOpaque[4 * 8 + 3] = 250
    expect(hasAlphaTransparency(unalignedOpaque)).toBe(true)

    const alignedOpaque = new Uint8ClampedArray(4 * 9).fill(255)
    expect(hasAlphaTransparency(alignedOpaque)).toBe(false)
    alignedOpaque[4 * 5 + 3] = 0
    expect(hasAlphaTransparency(alignedOpaque)).toBe(true)
  })

  test("home getStaticProps degrades gracefully with revalidate 15 when getPostsBootstrap fails", async () => {
    registerServerApiFetchMetrics()
    process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:1"
    delete process.env.ENABLE_QA_ROUTES
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as typeof fetch

    const result = (await getHomeStaticProps({} as never)) as {
      props: { initialHomeBootstrapStatus: string }
      revalidate: number
    }
    expect(result.props.initialHomeBootstrapStatus).toBe("degraded")
    expect(result.revalidate).toBe(15)
  })

  test("revalidate API enforces 32-path maximum, invalidates serverSnapshotCache, and uses Promise.allSettled", async () => {
    const secret = "test-revalidate-secret"
    process.env.TOKEN_FOR_REVALIDATE = secret

    let loadCount = 0
    await readServerSnapshot("admin:posts:1", 60_000, async () => {
      loadCount += 1
      return { ok: true }
    })
    expect(loadCount).toBe(1)

    const overLimitPaths = Array.from({ length: 33 }, (_, i) => `/p-${i}`)
    let statusOversized = 200
    const resOversized = {
      revalidate: async () => undefined,
      status(code: number) {
        statusOversized = code
        return this
      },
      json() {
        return this
      },
      send() {
        return this
      },
    } as unknown as NextApiResponse
    await revalidateHandler(
      { method: "POST", headers: { "x-revalidate-token": secret }, query: {}, body: { paths: overLimitPaths } } as unknown as NextApiRequest,
      resOversized
    )
    expect(statusOversized).toBe(400)

    const attempted: string[] = []
    let batchPayload: unknown
    let batchStatus = 200
    const resBatch = {
      revalidate: async (path: string) => {
        attempted.push(path)
        if (path === "/broken") throw new Error("revalidate boom")
      },
      status(code: number) {
        batchStatus = code
        return this
      },
      json(data: unknown) {
        batchPayload = data
        return this
      },
      send() {
        return this
      },
    } as unknown as NextApiResponse

    await revalidateHandler(
      { method: "POST", headers: { "x-revalidate-token": secret }, query: {}, body: { paths: ["/broken", "/"] } } as unknown as NextApiRequest,
      resBatch
    )
    expect(batchStatus).toBe(200)
    expect(attempted).toEqual(["/broken", "/"])
    expect(batchPayload).toMatchObject({
      revalidated: true,
      paths: ["/"],
      count: 1,
    })

    const nextSnap = await readServerSnapshot("admin:posts:1", 60_000, async () => {
      loadCount += 1
      return { ok: true }
    })
    expect(nextSnap.source).toBe("live")
    expect(loadCount).toBe(2)
  })

  test("normalizeContentHtmlForMermaid produces identical output across SSR/CSR and uses single-pass HTML stack", () => {
    const htmlInput = '<pre><code class="language-mermaid">flowchart TD<br>A--&gt;B<p>B--&gt;C</p></code></pre>'
    const ssrResult = normalizeContentHtmlForMermaid(htmlInput)
    expect(ssrResult).toContain('data-mermaid-source="flowchart TD&#10;A--&gt;B&#10;B--&gt;C"')

    const previousWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {
      DOMParser: class FakeDomParser {
        parseFromString() {
          return {
            querySelectorAll() {
              return []
            },
            body: { textContent: "DIFFERENT_CSR_OUTPUT" },
          }
        }
      },
    }
    try {
      const csrResult = normalizeContentHtmlForMermaid(htmlInput)
      expect(csrResult).toBe(ssrResult)
    } finally {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = previousWindow
    }

    const nestedContainerHtml =
      '<div data-raw-code="const x = 1;"><section><div class="inner"></div><pre><code>fallback</code></pre></section></div>'
    const normalizedContainer = normalizeContentHtmlForMermaid(nestedContainerHtml)
    expect(normalizedContainer).toContain('data-raw-code="const x = 1;"')
  })
})
