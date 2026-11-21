import { EventEmitter } from "node:events"
import { PassThrough, Readable } from "node:stream"
import { gzipSync } from "node:zlib"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "@playwright/test"
import { wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"
import {
  DEFAULT_RELEASE_FETCH_TIMEOUT_MS,
  EASYOFFICE_LATEST_MANIFEST_URL,
  EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL,
  EASYOFFICE_RELEASE_SNAPSHOT_TTL_MS,
  MAX_CHECKSUM_LINES,
  MAX_RELEASE_METADATA_BYTES,
  assertSafeGitHubReleaseUrl,
  decodeBoundedReleaseBuffer,
  fetchBoundedGitHubReleaseText,
  formatUtcReleaseDate,
  getLastKnownGoodEasyOfficeRelease,
  isValidStableSemver,
  parseEasyOfficeChecksums,
  parseEasyOfficeReleaseManifest,
  readBoundedReleaseStream,
  resetEasyOfficeReleaseStateForTests,
  resolveEasyOfficeReleaseSnapshot,
  resolvePublicReleaseAddress,
  type BoundedReleaseResponseStream,
  type ReleaseTransportFn,
} from "../../src/libs/server/easyofficeRelease"
import {
  EASYOFFICE_LATEST_RELEASE_URL,
  resolveEasyOfficeAssetUrl,
  resolvePlatformChecksums,
  type EasyOfficeReleaseInfo,
} from "../../src/routes/Company/CompanyDownloadModel"
import CompanyDownloadPageView from "../../src/routes/Company/CompanyDownloadPageView"

const WrappedDownloadView = wrapPlaywrightJsxComponent(CompanyDownloadPageView) as ComponentType<{
  initialOs: "macos" | "windows" | "linux"
  hasExplicitOsQuery: boolean
  surfaceUrl: string
  companyUrl: string
  release?: EasyOfficeReleaseInfo | null
}>

const makeDigest = (hexChar: string) => hexChar.repeat(64)

const V010_DIGESTS = {
  "EasyOffice-linux-arm64.deb":
    "965c9c7946a623012bb08b64fcae64240bdfa33f5f324b979c1fe7850e2c9b74",
  "EasyOffice-linux-x64.AppImage":
    "bfd29f2c09354724f5aeb679f5c8e30fd3b8248b7948b517eae266206a2f6168",
  "EasyOffice-linux-x64.deb":
    "cdc4d12ee621c6c7c8e1165c29495248f36e135701132dd3885fcfd8642b7fb0",
  "EasyOffice-linux-x64.rpm":
    "3f2f876a2bdbbd5649234a1c892d0791d847b141d11e209ae80417aa6400ff28",
  "EasyOffice-macos-universal.dmg":
    "c6be242fa2b0991ca6d24880c62fc8d8147f3d25afc9b118d967248af9b9dfd3",
  "EasyOffice-windows-x64-setup.exe":
    "9103620e6fd60bf08d7cf3843855e643d3d19abf1ec335cfca40b12d47872ee7",
} as const

const makeManifestJson = (version: string, pubDate: string) =>
  JSON.stringify({
    version,
    notes: `EasyOffice v${version}`,
    pub_date: pubDate,
    platforms: {
      "darwin-aarch64": {
        url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v${version}/EasyOffice-macos-universal.app.tar.gz`,
        signature: "c2lnbmF0dXJl",
      },
      "windows-x86_64": {
        url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v${version}/EasyOffice-windows-x64-setup.exe`,
        signature: "c2lnbmF0dXJl",
      },
      "linux-x86_64-deb": {
        url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v${version}/EasyOffice-linux-x64.deb`,
        signature: "c2lnbmF0dXJl",
      },
    },
  })

const makeChecksumsText = (digests: Readonly<Record<string, string>>) =>
  [
    `${digests["EasyOffice-linux-arm64.deb"]}  EasyOffice-linux-arm64.deb`,
    `32125e872110fc040b694f96ba7f53af4ea85b341469d8d1c6c73a221d677198  EasyOffice-linux-arm64.deb.sig`,
    `${digests["EasyOffice-linux-x64.AppImage"]}  EasyOffice-linux-x64.AppImage`,
    `${digests["EasyOffice-linux-x64.deb"]}  EasyOffice-linux-x64.deb`,
    `${digests["EasyOffice-linux-x64.rpm"]}  EasyOffice-linux-x64.rpm`,
    `${digests["EasyOffice-macos-universal.dmg"]}  EasyOffice-macos-universal.dmg`,
    `${digests["EasyOffice-windows-x64-setup.exe"]}  EasyOffice-windows-x64-setup.exe`,
    `1b3bcd96132e561fd6e8750ae97383405c6c4f2b9da23323f361e85022990b5f  latest.json`,
  ].join("\n")

const makeStreamResponse = ({
  statusCode = 200,
  headers = {},
  body = "",
}: {
  statusCode?: number
  headers?: Record<string, string>
  body?: string | Buffer
}): BoundedReleaseResponseStream => {
  const stream = Readable.from(body.length > 0 ? [Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8")] : [])
  const response = Object.assign(stream, {
    statusCode,
    headers,
  })
  return response as unknown as BoundedReleaseResponseStream
}

test.beforeEach(() => {
  resetEasyOfficeReleaseStateForTests()
})

test("상수 예산, stable semver 검사, UTC 발행일 포맷, 매니페스트 및 체크섬 파서를 정확히 검증한다", () => {
  expect(MAX_RELEASE_METADATA_BYTES).toBe(65_536)
  expect(DEFAULT_RELEASE_FETCH_TIMEOUT_MS).toBe(3_500)
  expect(EASYOFFICE_RELEASE_SNAPSHOT_TTL_MS).toBe(15 * 60 * 1_000)
  expect(EASYOFFICE_LATEST_MANIFEST_URL).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/latest/download/latest.json"
  )

  expect(isValidStableSemver("0.1.0")).toBe(true)
  expect(isValidStableSemver("10.24.3")).toBe(true)
  expect(isValidStableSemver("v0.1.0")).toBe(false)
  expect(isValidStableSemver("0.1.0-rc.1")).toBe(false)
  expect(isValidStableSemver("01.2.3")).toBe(false)
  expect(isValidStableSemver("1.02.3")).toBe(false)
  expect(isValidStableSemver("1.2")).toBe(false)
  expect(isValidStableSemver("../../etc/passwd")).toBe(false)

  expect(formatUtcReleaseDate(Date.parse("2026-11-12T03:27:50.630Z"))).toBe("2026.11.12")
  expect(formatUtcReleaseDate(Date.parse("2026-11-21T23:30:00.000Z"))).toBe("2026.11.21")

  const manifest = parseEasyOfficeReleaseManifest(makeManifestJson("0.1.0", "2026-11-12T03:27:50.630Z"))
  expect(manifest).toEqual({
    version: "0.1.0",
    tag: "v0.1.0",
    publishedDate: "2026.11.12",
    releaseUrl: "https://github.com/AquilaXk/easyoffice/releases/tag/v0.1.0",
  })

  const uppercaseSums = makeChecksumsText({
    "EasyOffice-linux-arm64.deb": V010_DIGESTS["EasyOffice-linux-arm64.deb"].toUpperCase(),
    "EasyOffice-linux-x64.AppImage": V010_DIGESTS["EasyOffice-linux-x64.AppImage"],
    "EasyOffice-linux-x64.deb": V010_DIGESTS["EasyOffice-linux-x64.deb"],
    "EasyOffice-linux-x64.rpm": V010_DIGESTS["EasyOffice-linux-x64.rpm"],
    "EasyOffice-macos-universal.dmg": V010_DIGESTS["EasyOffice-macos-universal.dmg"].toUpperCase(),
    "EasyOffice-windows-x64-setup.exe": V010_DIGESTS["EasyOffice-windows-x64-setup.exe"],
  })
  const checksums = parseEasyOfficeChecksums(`${uppercaseSums.replace(/\n/g, "\r\n")}\r\n`)
  expect(checksums).toEqual(V010_DIGESTS)
})

test("최신 릴리스 매니페스트와 해당 태그 체크섬을 원자적으로 조회하고 버전 고정 URL 및 OS별 체크섬을 렌더한다", async () => {
  const requestedUrls: string[] = []
  const transport: ReleaseTransportFn = async (url) => {
    requestedUrls.push(url.toString())
    if (url.toString() === EASYOFFICE_LATEST_MANIFEST_URL) {
      return makeStreamResponse({
        statusCode: 302,
        headers: {
          location: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/latest.json`,
        },
      })
    }
    if (url.toString() === `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/latest.json`) {
      return makeStreamResponse({
        statusCode: 200,
        body: makeManifestJson("0.1.0", "2026-11-12T03:27:50.630Z"),
      })
    }
    if (url.toString() === `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/SHA256SUMS.txt`) {
      return makeStreamResponse({
        statusCode: 200,
        body: makeChecksumsText(V010_DIGESTS),
      })
    }
    return makeStreamResponse({ statusCode: 404 })
  }

  const release = await resolveEasyOfficeReleaseSnapshot({ transport })
  expect(release).toEqual({
    version: "0.1.0",
    tag: "v0.1.0",
    publishedDate: "2026.11.12",
    releaseUrl: "https://github.com/AquilaXk/easyoffice/releases/tag/v0.1.0",
    checksums: V010_DIGESTS,
  })
  expect(requestedUrls).toEqual([
    EASYOFFICE_LATEST_MANIFEST_URL,
    `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/latest.json`,
    `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/SHA256SUMS.txt`,
  ])

  expect(resolveEasyOfficeAssetUrl("EasyOffice-macos-universal.dmg", release)).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/download/v0.1.0/EasyOffice-macos-universal.dmg"
  )
  expect(resolveEasyOfficeAssetUrl("SHA256SUMS.txt", release)).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/download/v0.1.0/SHA256SUMS.txt"
  )
  expect(resolvePlatformChecksums("linux", release)).toEqual([
    { assetName: "EasyOffice-linux-x64.deb", sha256: V010_DIGESTS["EasyOffice-linux-x64.deb"] },
    { assetName: "EasyOffice-linux-arm64.deb", sha256: V010_DIGESTS["EasyOffice-linux-arm64.deb"] },
    { assetName: "EasyOffice-linux-x64.rpm", sha256: V010_DIGESTS["EasyOffice-linux-x64.rpm"] },
    {
      assetName: "EasyOffice-linux-x64.AppImage",
      sha256: V010_DIGESTS["EasyOffice-linux-x64.AppImage"],
    },
  ])

  const macHtml = renderToStaticMarkup(
    createElement(WrappedDownloadView, {
      initialOs: "macos",
      hasExplicitOsQuery: true,
      surfaceUrl: "https://www.aquilaxk.site/download",
      companyUrl: "https://www.aquilaxk.site",
      release,
    })
  )
  expect(macHtml).toContain("v0.1.0 · 2026.11.12")
  expect(macHtml).toContain('href="https://github.com/AquilaXk/easyoffice/releases/tag/v0.1.0"')
  expect(macHtml).toContain(
    'href="https://github.com/AquilaXk/easyoffice/releases/download/v0.1.0/EasyOffice-macos-universal.dmg"'
  )
  expect(macHtml).toContain('data-ui="easyoffice-release-checksums"')
  expect(macHtml).toContain(V010_DIGESTS["EasyOffice-macos-universal.dmg"])
  const verifySectionIndex = macHtml.indexOf('id="verify-install"')
  const firstCodeIndex = macHtml.indexOf("<code>", verifySectionIndex)
  const checksumBlockIndex = macHtml.indexOf('data-ui="easyoffice-release-checksums"')
  expect(verifySectionIndex).toBeGreaterThan(-1)
  expect(firstCodeIndex).toBeGreaterThan(verifySectionIndex)
  expect(firstCodeIndex).toBeLessThan(checksumBlockIndex)
  expect(macHtml.slice(firstCodeIndex, checksumBlockIndex)).toContain(
    "xattr -dr com.apple.quarantine"
  )
})

test("TTL 내 중복 조회를 합치고 만료 후 장애 시 직전 정상 릴리스 스냅샷(stale-if-error)을 유지한다", async () => {
  let calls = 0
  let shouldFail = false
  const v020Digests = {
    "EasyOffice-linux-arm64.deb": makeDigest("a"),
    "EasyOffice-linux-x64.AppImage": makeDigest("b"),
    "EasyOffice-linux-x64.deb": makeDigest("c"),
    "EasyOffice-linux-x64.rpm": makeDigest("d"),
    "EasyOffice-macos-universal.dmg": makeDigest("e"),
    "EasyOffice-windows-x64-setup.exe": makeDigest("f"),
  }

  const transport: ReleaseTransportFn = async (url) => {
    calls += 1
    if (shouldFail) {
      return makeStreamResponse({ statusCode: 503 })
    }
    if (url.toString() === EASYOFFICE_LATEST_MANIFEST_URL) {
      return makeStreamResponse({
        statusCode: 200,
        body: makeManifestJson("0.2.0", "2026-11-21T10:00:00Z"),
      })
    }
    return makeStreamResponse({
      statusCode: 200,
      body: makeChecksumsText(v020Digests),
    })
  }

  const [first, second] = await Promise.all([
    resolveEasyOfficeReleaseSnapshot({ transport, ttlMs: 60_000 }),
    resolveEasyOfficeReleaseSnapshot({ transport, ttlMs: 60_000 }),
  ])
  expect(first?.tag).toBe("v0.2.0")
  expect(second?.tag).toBe("v0.2.0")
  expect(calls).toBe(2) // manifest + checksums 1회만

  const cached = await resolveEasyOfficeReleaseSnapshot({ transport, ttlMs: 60_000 })
  expect(cached?.tag).toBe("v0.2.0")
  expect(calls).toBe(2)

  // 캐시 만료 시뮬레이션(ttlMs: 0 + 다른 key 대신 resetCacheWithoutClearingLkg -> ttlMs 0으로 만료시킴)
  shouldFail = true
  const staleFallback = await resolveEasyOfficeReleaseSnapshot({
    transport,
    ttlMs: 0,
    cacheKeySuffix: "expired-check",
  })
  expect(staleFallback?.tag).toBe("v0.2.0")
  expect(staleFallback?.publishedDate).toBe("2026.11.21")
  expect(getLastKnownGoodEasyOfficeRelease()?.tag).toBe("v0.2.0")
})

test("콜드 스타트 조회 실패 시 null과 안전한 releases/latest 폴백을 반환하고 가짜 버전을 노출하지 않는다", async () => {
  const failingTransport: ReleaseTransportFn = async () => {
    throw new Error("ETIMEDOUT")
  }

  const release = await resolveEasyOfficeReleaseSnapshot({ transport: failingTransport })
  expect(release).toBeNull()

  expect(resolveEasyOfficeAssetUrl("EasyOffice-macos-universal.dmg", null)).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-macos-universal.dmg"
  )
  expect(resolvePlatformChecksums("macos", null)).toEqual([])

  const fallbackHtml = renderToStaticMarkup(
    createElement(WrappedDownloadView, {
      initialOs: "macos",
      hasExplicitOsQuery: true,
      surfaceUrl: "https://www.aquilaxk.site/download",
      companyUrl: "https://www.aquilaxk.site",
      release: null,
    })
  )
  expect(fallbackHtml).toContain("최신 정식 릴리스")
  expect(fallbackHtml).toContain(`href="${EASYOFFICE_LATEST_RELEASE_URL}"`)
  expect(fallbackHtml).toContain(
    'href="https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-macos-universal.dmg"'
  )
  expect(fallbackHtml).not.toContain("v0.2.0")
  expect(fallbackHtml).not.toContain('data-ui="easyoffice-release-checksums"')
})

test("비신뢰·악의적 입력(크기 초과, 압축 폭탄, 비공개 IP DNS, 허용되지 않은 호스트, 변조 JSON·체크섬)을 Fail-Closed로 거부한다", async () => {
  // 1. 스트림 바이트 상한 초과
  const stream = new PassThrough()
  let aborted = false
  const response = Object.assign(stream, {
    statusCode: 200,
    headers: {},
  }) as unknown as BoundedReleaseResponseStream
  const streamPromise = readBoundedReleaseStream(response, () => {
    aborted = true
  })
  stream.write(Buffer.alloc(MAX_RELEASE_METADATA_BYTES + 1, 0x61))
  await expect(streamPromise).rejects.toThrow()
  expect(aborted).toBe(true)

  // 1-b. Content-Length 헤더 초과 시 unhandled error 이벤트 없이 즉시 차단
  const oversizedHeaderStream = new PassThrough()
  let headerAborted = false
  const oversizedHeaderResponse = Object.assign(oversizedHeaderStream, {
    statusCode: 200,
    headers: { "content-length": String(MAX_RELEASE_METADATA_BYTES + 1) },
  }) as unknown as BoundedReleaseResponseStream
  await expect(
    readBoundedReleaseStream(oversizedHeaderResponse, () => {
      headerAborted = true
    })
  ).rejects.toThrow()
  expect(headerAborted).toBe(true)

  // 1-c. 조기 연결 종료("close" without "end") Fail-Closed 처리
  const prematureStream = new PassThrough()
  const prematureResponse = Object.assign(prematureStream, {
    statusCode: 200,
    headers: {},
  }) as unknown as BoundedReleaseResponseStream
  const prematurePromise = readBoundedReleaseStream(prematureResponse)
  prematureStream.destroy()
  await expect(prematurePromise).rejects.toThrow()

  // 2. gzip 압축 해제 폭탄 차단 (maxOutputLength 초과)
  const hugePayload = Buffer.alloc(MAX_RELEASE_METADATA_BYTES + 1024, 0x41)
  const gzippedBomb = gzipSync(hugePayload)
  expect(gzippedBomb.byteLength).toBeLessThan(MAX_RELEASE_METADATA_BYTES)
  expect(() => decodeBoundedReleaseBuffer(gzippedBomb, "gzip")).toThrow()
  expect(() => decodeBoundedReleaseBuffer(Buffer.from("ok"), "unknown-encoding")).toThrow()

  // 3. URL 화이트리스트 / 포트 / 자격 증명 / 상위 경로 탈출 거부
  expect(() =>
    assertSafeGitHubReleaseUrl("http://github.com/AquilaXk/easyoffice/releases/latest/download/latest.json")
  ).toThrow()
  expect(() => assertSafeGitHubReleaseUrl("https://evil.example/latest.json")).toThrow()
  expect(() => assertSafeGitHubReleaseUrl("https://github.com:8443/AquilaXk/easyoffice/latest.json")).toThrow()
  expect(() => assertSafeGitHubReleaseUrl("https://user:pass@github.com/AquilaXk/easyoffice/latest.json")).toThrow()
  expect(() =>
    assertSafeGitHubReleaseUrl("https://github.com/AquilaXk/easyoffice/%2e%2e/latest.json")
  ).toThrow()
  expect(() =>
    assertSafeGitHubReleaseUrl("https://github.com/AquilaXk/easyoffice/%zz/latest.json")
  ).toThrow()
  expect(() => assertSafeGitHubReleaseUrl("https://github.com/other/repo/latest.json")).toThrow()
  expect(() =>
    assertSafeGitHubReleaseUrl("https://github.com/AquilaXk/easyoffice/..\\latest.json")
  ).toThrow()

  // 4. 사설·루프백·링크로컬·IPv4-mapped IPv6 DNS 결과 차단
  for (const blockedAddress of [
    { address: "127.0.0.1", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "::ffff:10.0.0.1", family: 6 },
    { address: "fc00::1", family: 6 },
  ]) {
    await expect(
      resolvePublicReleaseAddress("github.com", async () => [blockedAddress])
    ).rejects.toThrow()
  }
  await expect(resolvePublicReleaseAddress("127.0.0.1")).rejects.toThrow()

  // 5. >4 리다이렉트 또는 악성 리다이렉트 대상 거부
  const evilRedirectTransport: ReleaseTransportFn = async () =>
    makeStreamResponse({
      statusCode: 302,
      headers: { location: "https://evil.example/latest.json" },
    })
  await expect(
    fetchBoundedGitHubReleaseText(EASYOFFICE_LATEST_MANIFEST_URL, {
      transport: evilRedirectTransport,
    })
  ).rejects.toThrow()

  const loopTransport: ReleaseTransportFn = async () =>
    makeStreamResponse({
      statusCode: 302,
      headers: { location: EASYOFFICE_LATEST_MANIFEST_URL },
    })
  await expect(
    fetchBoundedGitHubReleaseText(EASYOFFICE_LATEST_MANIFEST_URL, {
      transport: loopTransport,
    })
  ).rejects.toThrow()

  // 6. 변조·위조 manifest 거부
  expect(() =>
    parseEasyOfficeReleaseManifest(
      JSON.stringify({
        version: "../../etc/passwd",
        pub_date: "2026-11-12T00:00:00Z",
        platforms: { "darwin-aarch64": { url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/a` } },
      })
    )
  ).toThrow()
  expect(() =>
    parseEasyOfficeReleaseManifest(
      JSON.stringify({
        version: "0.2.0",
        pub_date: "not-a-date",
        platforms: { "darwin-aarch64": { url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.2.0/a` } },
      })
    )
  ).toThrow()
  expect(() =>
    parseEasyOfficeReleaseManifest(
      JSON.stringify({
        version: "0.2.0",
        pub_date: "2026-11-21T00:00:00Z",
        platforms: {},
      })
    )
  ).toThrow()
  expect(() =>
    parseEasyOfficeReleaseManifest(
      JSON.stringify({
        version: "0.2.0",
        pub_date: "2026-11-21T00:00:00Z",
        platforms: {
          "darwin-aarch64": {
            url: `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/v0.1.0/EasyOffice-macos-universal.app.tar.gz`,
          },
        },
      })
    )
  ).toThrow()

  // 7. 손상·중복·줄수 초과·누락 SHA256SUMS.txt 거부
  const baseLines = makeChecksumsText(V010_DIGESTS)
  expect(() =>
    parseEasyOfficeChecksums(baseLines.replace("c6be", "zzzz"))
  ).toThrow()
  expect(() =>
    parseEasyOfficeChecksums(baseLines.replace(V010_DIGESTS["EasyOffice-macos-universal.dmg"], "abcd"))
  ).toThrow()
  expect(() =>
    parseEasyOfficeChecksums(
      `${baseLines}\n${makeDigest("9")}  EasyOffice-macos-universal.dmg`
    )
  ).toThrow()
  const tooManyLines = Array.from(
    { length: MAX_CHECKSUM_LINES + 1 },
    (_, index) => `${makeDigest("a")}  extra-asset-${index}.txt`
  ).join("\n")
  expect(() => parseEasyOfficeChecksums(tooManyLines)).toThrow()
  expect(() =>
    parseEasyOfficeChecksums(`${V010_DIGESTS["EasyOffice-macos-universal.dmg"]}  EasyOffice-macos-universal.dmg`)
  ).toThrow()
})
