const IPV4_PRIVATE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8 (This host / unspecified)
  [0x0a000000, 0x0affffff], // 10.0.0.0/8 (RFC 1918)
  [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (Loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (Link-local / cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12 (RFC 1918)
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24 (IETF Protocol Assignments)
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET-1)
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 (RFC 1918)
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (Benchmarking)
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (TEST-NET-2)
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
  [0xe0000000, 0xffffffff], // 224.0.0.0/4 Multicast & 240.0.0.0/4 Reserved/Broadcast
]

const HEX_GROUP_RE = /^[0-9a-f]{1,4}$/

export const ipv4ToNumber = (ip: string): number | null => {
  const parts = ip.trim().split(".")
  if (parts.length !== 4) return null

  let result = 0
  for (let i = 0; i < 4; i += 1) {
    const part = parts[i]
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number.parseInt(part, 10)
    if (octet < 0 || octet > 255) return null
    result = ((result << 8) | octet) >>> 0
  }
  return result
}

export const isPrivateIpv4Number = (numericIp: number): boolean => {
  const unsigned = numericIp >>> 0
  for (let i = 0; i < IPV4_PRIVATE_RANGES.length; i += 1) {
    const [start, end] = IPV4_PRIVATE_RANGES[i]
    if (unsigned >= start && unsigned <= end) return true
  }
  return false
}

export const isPrivateIpv4 = (ip: string): boolean => {
  const numericIp = ipv4ToNumber(ip)
  if (numericIp === null) return true
  return isPrivateIpv4Number(numericIp)
}

/**
 * Parse an IPv6 address (including compressed `::` and trailing embedded IPv4)
 * into eight 16-bit big-endian words inside a `Uint16Array(8)`.
 * Returns `null` when malformed so callers fail closed.
 */
export const parseIpv6Words = (rawIp: string): Uint16Array | null => {
  let normalized = rawIp.trim().toLowerCase()
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1)
  }
  const zoneIndex = normalized.indexOf("%")
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex)
  }
  if (!normalized || normalized.length > 64) return null

  const words = new Uint16Array(8)
  const doubleColonIndex = normalized.indexOf("::")
  if (doubleColonIndex >= 0 && normalized.indexOf("::", doubleColonIndex + 2) >= 0) {
    return null
  }

  let leftRaw = normalized
  let rightRaw = ""
  const hasCompression = doubleColonIndex >= 0
  if (hasCompression) {
    leftRaw = normalized.slice(0, doubleColonIndex)
    rightRaw = normalized.slice(doubleColonIndex + 2)
  }

  const parseSegmentList = (segmentText: string): number[] | null => {
    if (!segmentText) return []
    const tokens = segmentText.split(":")
    const parsed: number[] = []
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      if (!token) return null
      if (token.includes(".")) {
        if (i !== tokens.length - 1) return null
        const v4 = ipv4ToNumber(token)
        if (v4 === null) return null
        parsed.push((v4 >>> 16) & 0xffff, v4 & 0xffff)
      } else {
        if (!HEX_GROUP_RE.test(token)) return null
        parsed.push(Number.parseInt(token, 16) & 0xffff)
      }
    }
    return parsed
  }

  const leftWords = parseSegmentList(leftRaw)
  if (leftWords === null) return null

  if (!hasCompression) {
    if (leftWords.length !== 8) return null
    for (let i = 0; i < 8; i += 1) words[i] = leftWords[i]
    return words
  }

  const rightWords = parseSegmentList(rightRaw)
  if (rightWords === null) return null

  const totalExplicit = leftWords.length + rightWords.length
  if (totalExplicit > 7) return null

  for (let i = 0; i < leftWords.length; i += 1) {
    words[i] = leftWords[i]
  }
  const rightStart = 8 - rightWords.length
  for (let i = 0; i < rightWords.length; i += 1) {
    words[rightStart + i] = rightWords[i]
  }
  return words
}

export const isPrivateIpv6Words = (w: Uint16Array): boolean => {
  if (w.length !== 8) return true

  const topSixZero = w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0
  // :: (unspecified), ::1 (loopback), ::/96 (IPv4-compatible)
  if (topSixZero) {
    if (w[6] === 0 && (w[7] === 0 || w[7] === 1)) return true
    return isPrivateIpv4Number(((w[6] << 16) | w[7]) >>> 0)
  }

  // ::ffff:0:0/96 (IPv4-mapped IPv6) -> recursive IPv4 check
  if (w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0xffff) {
    return isPrivateIpv4Number(((w[6] << 16) | w[7]) >>> 0)
  }

  // ::ffff:0:0:0/96 (IPv4-translated / SIIT) -> recursive IPv4 check
  if (w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0xffff && w[5] === 0) {
    return isPrivateIpv4Number(((w[6] << 16) | w[7]) >>> 0)
  }

  // NAT64: 64:ff9b::/96 (Well-Known) & 64:ff9b:1::/48 (Local-Use)
  if (w[0] === 0x0064 && w[1] === 0xff9b) {
    if (w[2] === 0x0001) return true
    if (w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0) return true
  }

  // 100::/64 (Discard-Only)
  if (w[0] === 0x0100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return true

  // 2001::/32 (Teredo) and 2001:db8::/32 (Documentation)
  if (w[0] === 0x2001 && (w[1] === 0x0000 || w[1] === 0x0db8)) return true

  // 2002::/16 (6to4 transition)
  if (w[0] === 0x2002) return true

  // fc00::/7 (Unique Local Address), fe80::/10 (Link-Local), fec0::/10 (Site-Local), ff00::/8 (Multicast)
  if ((w[0] & 0xfe00) === 0xfc00) return true
  if ((w[0] & 0xffc0) === 0xfe80) return true
  if ((w[0] & 0xffc0) === 0xfec0) return true
  if ((w[0] & 0xff00) === 0xff00) return true

  return false
}

export const isPrivateIpv6 = (ip: string): boolean => {
  const words = parseIpv6Words(ip)
  if (!words) return true
  return isPrivateIpv6Words(words)
}

export const isPublicExternalHostname = (rawHostname: string): boolean => {
  const host = rawHostname.trim().toLowerCase().replace(/\.$/, "")
  if (!host || host.includes("%")) return false

  if (
    host === "localhost" ||
    host === "invalid" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".arpa") ||
    host.endsWith(".invalid")
  ) {
    return false
  }

  if (host.startsWith("[") || host.includes(":")) {
    return !isPrivateIpv6(host)
  }

  const ipv4Number = ipv4ToNumber(host)
  if (ipv4Number !== null) {
    return !isPrivateIpv4Number(ipv4Number)
  }

  // Reject single-label hostnames or obscured integer/hex IP forms (e.g. 2130706433, 0x7f000001)
  if (!host.includes(".")) return false
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false

  return true
}
