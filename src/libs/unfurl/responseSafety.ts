import type { IncomingMessage } from "node:http"
import type { Transform } from "node:stream"
import {
  brotliDecompressSync,
  createBrotliDecompress,
  createGunzip,
  createInflate,
  gunzipSync,
  inflateSync,
} from "node:zlib"

export const MAX_UNFURL_RESPONSE_BYTES = 262_144
const MAX_UNFURL_ENCODING_LAYERS = 3
const HEAD_CLOSE_BYTES_LOWER = Buffer.from("</head>")
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308])

export class UnfurlResponseTooLargeError extends Error {
  constructor() {
    super("외부 링크 응답 크기가 허용 상한(256KB)을 초과했습니다.")
    this.name = "UnfurlResponseTooLargeError"
  }
}

export class UnfurlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnfurlValidationError"
  }
}

export class UnfurlUnsupportedEncodingError extends Error {
  constructor(message = "지원하지 않는 응답 인코딩입니다.") {
    super(message)
    this.name = "UnfurlUnsupportedEncodingError"
  }
}

export class UnfurlUpstreamRedirectError extends Error {
  constructor(message = "리다이렉트 처리 중 오류가 발생했습니다.") {
    super(message)
    this.name = "UnfurlUpstreamRedirectError"
  }
}

export type BoundedIncomingResponseStream = {
  statusCode?: number
  headers: IncomingMessage["headers"]
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown
  on(event: "end", listener: () => void): unknown
  on(event: "error", listener: (error: Error) => void): unknown
  destroy: (error?: Error) => unknown
  resume: () => unknown
}

const findHeadClosingEndOffset = (buffer: Buffer, searchFrom: number): number => {
  const needle = HEAD_CLOSE_BYTES_LOWER
  const start = Math.max(0, searchFrom)
  outer: for (let i = start; i <= buffer.byteLength - needle.byteLength; i += 1) {
    for (let j = 0; j < needle.byteLength; j += 1) {
      let byte = buffer[i + j]!
      if (byte >= 65 && byte <= 90) byte += 32
      if (byte !== needle[j]) continue outer
    }
    return i + needle.byteLength
  }
  return -1
}

const extractCharsetFromHeader = (contentType: string): string => {
  const match = /charset\s*=\s*(?:"([^";]+)"|'([^';]+)'|([^;\s]+))/i.exec(contentType)
  return (match?.[1] || match?.[2] || match?.[3] || "").trim()
}

const extractCharsetFromHtmlPrefix = (buffer: Buffer): string => {
  const prefix = buffer.subarray(0, Math.min(buffer.byteLength, 4096)).toString("latin1")
  const metaCharset = /<meta[^>]+charset\s*=\s*(?:"([^";]+)"|'([^';]+)'|([^\s"'>/;]+))/i.exec(prefix)
  return (metaCharset?.[1] || metaCharset?.[2] || metaCharset?.[3] || "").trim()
}

export const decodeHtmlBufferWithCharset = (buffer: Buffer, contentTypeHeader = ""): string => {
  if (buffer.byteLength >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3))
  }
  if (buffer.byteLength >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2))
  }
  if (buffer.byteLength >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2))
  }

  const candidateCharset =
    extractCharsetFromHeader(contentTypeHeader) || extractCharsetFromHtmlPrefix(buffer)
  if (candidateCharset && !/^utf-?8$/i.test(candidateCharset)) {
    try {
      return new TextDecoder(candidateCharset).decode(buffer)
    } catch {
      // Unsupported charset label falls back cleanly to UTF-8
    }
  }
  return buffer.toString("utf8")
}

const parseEncodingLayers = (encoding: string): string[] =>
  encoding
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0 && token !== "identity")

const isSupportedEncodingLayer = (layer: string) =>
  layer === "gzip" || layer === "x-gzip" || layer === "deflate" || layer === "br"

export const decodeUnfurlResponseBuffer = (buffer: Buffer, encoding: string): Buffer => {
  if (buffer.byteLength > MAX_UNFURL_RESPONSE_BYTES) {
    throw new UnfurlResponseTooLargeError()
  }

  const layers = parseEncodingLayers(encoding)
  if (layers.length === 0) return buffer
  if (layers.length > MAX_UNFURL_ENCODING_LAYERS) {
    throw new UnfurlUnsupportedEncodingError()
  }

  const zlibOptions = { maxOutputLength: MAX_UNFURL_RESPONSE_BYTES }
  let current = buffer
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!
    try {
      if (layer === "gzip" || layer === "x-gzip") {
        current = gunzipSync(current, zlibOptions)
      } else if (layer === "deflate") {
        current = inflateSync(current, zlibOptions)
      } else if (layer === "br") {
        current = brotliDecompressSync(current, zlibOptions)
      } else {
        throw new UnfurlUnsupportedEncodingError()
      }
    } catch (error) {
      if (error instanceof UnfurlUnsupportedEncodingError) throw error
      const code = (error as { code?: unknown } | null)?.code
      if (code === "ERR_BUFFER_TOO_LARGE" || error instanceof RangeError) {
        throw new UnfurlResponseTooLargeError()
      }
      throw new UnfurlUnsupportedEncodingError()
    }
  }
  return current
}

const buildFetchHeadersFromIncoming = (rawHeaders: IncomingMessage["headers"]) => {
  const responseHeaders = new Headers()
  Object.entries(rawHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      responseHeaders.set(key, value)
      return
    }
    if (Array.isArray(value)) {
      responseHeaders.set(key, value.join(", "))
    }
  })
  return responseHeaders
}

const createTransformForLayer = (layer: string): Transform => {
  const streamOptions = { chunkSize: 8192 }
  if (layer === "gzip" || layer === "x-gzip") return createGunzip(streamOptions)
  if (layer === "deflate") return createInflate(streamOptions)
  return createBrotliDecompress(streamOptions)
}

const createBoundedBodyCollector = (stopAtHeadEnd: boolean) => {
  const outputChunks: Buffer[] = []
  let outputBytes = 0
  let tailCarry: Buffer = Buffer.alloc(0)

  return {
    pushChunk(buf: Buffer): Buffer | null {
      if (stopAtHeadEnd) {
        const combinedTail = tailCarry.byteLength > 0 ? Buffer.concat([tailCarry, buf]) : buf
        const headEndInTail = findHeadClosingEndOffset(combinedTail, 0)
        if (headEndInTail !== -1) {
          const sliceLenInCurrentChunk = Math.max(0, headEndInTail - tailCarry.byteLength)
          if (outputBytes + sliceLenInCurrentChunk <= MAX_UNFURL_RESPONSE_BYTES) {
            const keptChunk = buf.subarray(0, sliceLenInCurrentChunk)
            outputChunks.push(keptChunk)
            outputBytes += keptChunk.byteLength
            return Buffer.concat(outputChunks, outputBytes)
          }
        }
        const carryLen = Math.min(HEAD_CLOSE_BYTES_LOWER.byteLength - 1, combinedTail.byteLength)
        tailCarry = combinedTail.subarray(combinedTail.byteLength - carryLen)
      }

      outputBytes += buf.byteLength
      if (outputBytes > MAX_UNFURL_RESPONSE_BYTES) {
        throw new UnfurlResponseTooLargeError()
      }
      outputChunks.push(buf)
      return null
    },
    finish(): Buffer {
      return Buffer.concat(outputChunks, outputBytes)
    },
  }
}

export const readBoundedIncomingResponse = (
  response: BoundedIncomingResponseStream,
  abortUpstream?: () => void,
  options?: { stopAtHeadEnd?: boolean }
): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    const statusCode = response.statusCode || 502
    const responseHeaders = buildFetchHeadersFromIncoming(response.headers)

    if (REDIRECT_STATUS_CODES.has(statusCode)) {
      response.resume()
      resolve(
        new Response(null, {
          status: statusCode,
          headers: responseHeaders,
        })
      )
      return
    }

    const encodingLayers = parseEncodingLayers(`${response.headers["content-encoding"] || ""}`)
    if (
      encodingLayers.length > MAX_UNFURL_ENCODING_LAYERS ||
      encodingLayers.some((layer) => !isSupportedEncodingLayer(layer))
    ) {
      const encodingError = new UnfurlUnsupportedEncodingError()
      response.destroy(encodingError)
      abortUpstream?.()
      reject(encodingError)
      return
    }

    const contentTypeHeader = `${response.headers["content-type"] || ""}`
    const mediaType = contentTypeHeader.split(";", 1)[0]?.trim().toLowerCase() || ""
    const stopAtHeadEnd =
      Boolean(options?.stopAtHeadEnd) &&
      (mediaType === "text/html" || mediaType === "application/xhtml+xml" || !mediaType)

    const declaredLengthRaw = response.headers["content-length"]
    const declaredLength =
      typeof declaredLengthRaw === "string" ? Number.parseInt(declaredLengthRaw, 10) : Number.NaN
    if (!stopAtHeadEnd && Number.isFinite(declaredLength) && declaredLength > MAX_UNFURL_RESPONSE_BYTES) {
      const limitError = new UnfurlResponseTooLargeError()
      response.destroy(limitError)
      abortUpstream?.()
      reject(limitError)
      return
    }

    let settled = false
    const transforms: Transform[] = []

    const abortStreams = () => {
      response.destroy()
      abortUpstream?.()
      for (const transform of transforms) {
        transform.destroy()
      }
    }

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      abortStreams()
      reject(error)
    }

    const resolveDecodedBody = (decodedBody: Buffer) => {
      try {
        const textBody = decodeHtmlBufferWithCharset(decodedBody, contentTypeHeader)
        responseHeaders.delete("content-encoding")
        settled = true
        resolve(
          new Response(textBody, {
            status: statusCode,
            headers: responseHeaders,
          })
        )
      } catch (error) {
        fail(error)
      }
    }

    const decodedCollector = createBoundedBodyCollector(stopAtHeadEnd)
    let rawReceivedBytes = 0

    if (encodingLayers.length === 0) {
      response.on("data", (chunk) => {
        if (settled) return
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        try {
          const earlyHead = decodedCollector.pushChunk(buf)
          if (earlyHead) {
            settled = true
            abortStreams()
            resolveDecodedBody(earlyHead)
          }
        } catch (error) {
          fail(error)
        }
      })
      response.on("error", fail)
      response.on("end", () => {
        if (settled) return
        resolveDecodedBody(decodedCollector.finish())
      })
      return
    }

    for (let i = encodingLayers.length - 1; i >= 0; i -= 1) {
      const transform = createTransformForLayer(encodingLayers[i]!)
      transform.on("error", () => {
        fail(new UnfurlUnsupportedEncodingError())
      })
      transforms.push(transform)
    }

    for (let i = 0; i < transforms.length - 1; i += 1) {
      transforms[i]!.pipe(transforms[i + 1]!)
    }

    const firstTransform = transforms[0]!
    const lastTransform = transforms[transforms.length - 1]!

    lastTransform.on("data", (chunk) => {
      if (settled) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      try {
        const earlyHead = decodedCollector.pushChunk(buf)
        if (earlyHead) {
          settled = true
          abortStreams()
          resolveDecodedBody(earlyHead)
        }
      } catch (error) {
        fail(error)
      }
    })

    lastTransform.on("end", () => {
      if (settled) return
      resolveDecodedBody(decodedCollector.finish())
    })

    response.on("data", (chunk) => {
      if (settled) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      rawReceivedBytes += buf.byteLength
      if (rawReceivedBytes > MAX_UNFURL_RESPONSE_BYTES) {
        fail(new UnfurlResponseTooLargeError())
        return
      }
      firstTransform.write(buf)
    })

    response.on("error", fail)
    response.on("end", () => {
      if (settled) return
      firstTransform.end()
    })
  })
