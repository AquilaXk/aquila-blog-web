import { existsSync, readdirSync, readFileSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { spawn } from "node:child_process"

const root = process.cwd()
const token = process.env.WEB_METRICS_TOKEN?.trim()
if (!token || token.length < 32) throw new Error("WEB_METRICS_TOKEN must be at least 32 characters")

const port = Number.parseInt(process.env.WEB_METRICS_TEST_PORT || "3111", 10)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("WEB_METRICS_TEST_PORT must be a bounded TCP port")

const staticRoot = path.join(root, ".next/static")
const standaloneRoot = path.join(root, ".next/standalone")
const serverPath = path.join(standaloneRoot, "server.js")
const promClientPath = path.join(standaloneRoot, "node_modules/prom-client")
if (!existsSync(staticRoot) || !existsSync(serverPath) || !existsSync(promClientPath)) {
  throw new Error("Standalone runtime metrics build output is incomplete")
}

const findStaticJavaScript = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name)
  if (entry.isDirectory()) return findStaticJavaScript(entryPath)
  return entry.name.endsWith(".js") ? [entryPath] : []
})

for (const filePath of findStaticJavaScript(staticRoot)) {
  const source = readFileSync(filePath, "utf8")
  if (["prom-client", "collectDefaultMetrics", "aquila_web_"].some((needle) => source.includes(needle))) {
    throw new Error("Runtime metrics implementation leaked into a browser bundle")
  }
}

const request = (method, pathname, authorization, deadline) => new Promise((resolve, reject) => {
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) {
    reject(new Error("Standalone runtime metrics probe timed out"))
    return
  }
  let settled = false
  const settle = (callback, value) => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    callback(value)
  }
  const timeout = setTimeout(() => req.destroy(new Error("Standalone runtime metrics probe timed out")), Math.min(2_000, remainingMs))
  const req = http.request({ host: "127.0.0.1", port, path: pathname, method, headers: authorization ? { Authorization: authorization } : {} }, (res) => {
    let body = ""
    res.setEncoding("utf8")
    res.on("data", (chunk) => { body += chunk })
    res.on("end", () => settle(resolve, { status: res.statusCode, headers: res.headers, body }))
    res.on("error", () => settle(reject, new Error("Standalone runtime metrics probe failed")))
    res.on("aborted", () => settle(reject, new Error("Standalone runtime metrics probe failed")))
  })
  req.on("error", () => settle(reject, new Error("Standalone runtime metrics probe failed")))
  req.end()
})

const waitForReady = async (deadline, childState) => {
  while (Date.now() < deadline) {
    if (childState.error || childState.exited) throw new Error("Standalone runtime metrics server failed before ready")
    try {
      const response = await request("GET", "/api/internal/metrics", undefined, deadline)
      if (response.status === 401) return
    } catch {
      // The owned standalone server may not have bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error("Standalone runtime metrics endpoint did not become ready")
}

const waitForExit = async (childState, timeoutMs) => {
  if (childState.exited) return true
  return await Promise.race([
    childState.exitPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])
}

const terminate = async (child, childState) => {
  if (await waitForExit(childState, 0)) return
  child.kill("SIGTERM")
  if (await waitForExit(childState, 1_000)) return
  child.kill("SIGKILL")
  if (await waitForExit(childState, 1_000)) return
  throw new Error("Standalone runtime metrics server did not exit")
}

const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneRoot,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), WEB_METRICS_TOKEN: token },
  stdio: "ignore",
})
let resolveExit
const childState = {
  error: false,
  exited: child.exitCode !== null,
  exitPromise: new Promise((resolve) => { resolveExit = resolve }),
}
child.on("error", () => {
  childState.error = true
  childState.exited = true
  resolveExit()
})
child.on("exit", () => {
  childState.exited = true
  resolveExit()
})

try {
  const deadline = Date.now() + 15_000
  await waitForReady(deadline, childState)
  const missing = await request("GET", "/api/internal/metrics", undefined, deadline)
  const wrong = await request("GET", "/api/internal/metrics", "Bearer invalid-metrics-token", deadline)
  const wrongMethod = await request("POST", "/api/internal/metrics", `Bearer ${token}`, deadline)
  const publicPage = await request("GET", "/about", undefined, deadline)
  const valid = await request("GET", "/api/internal/metrics", `Bearer ${token}`, deadline)

  if (missing.status !== 401 || wrong.status !== 401) throw new Error("Metrics endpoint authentication contract failed")
  if (wrongMethod.status !== 405 || wrongMethod.headers.allow !== "GET") throw new Error("Metrics endpoint method contract failed")
  if (publicPage.status !== 200) throw new Error("Standalone SSR page contract failed")
  if (valid.status !== 200 || !/^text\/(plain|openmetrics)/i.test(String(valid.headers["content-type"] || ""))) {
    throw new Error("Metrics endpoint exposition contract failed")
  }
  if (!["aquila_web_process_resident_memory_bytes", "aquila_web_process_uptime_seconds"].every((name) => valid.body.includes(name))) {
    throw new Error("Metrics endpoint process evidence is incomplete")
  }
  if (!/aquila_web_ssr_request_duration_seconds_count\{route_class="public",result="props"\} [1-9]\d*/.test(valid.body)) {
    throw new Error("Metrics endpoint cross-bundle SSR evidence is incomplete")
  }
  if (/\b(request_id|path|status)=/.test(valid.body)) throw new Error("Metrics endpoint exposed a sensitive label")
} finally {
  await terminate(child, childState)
}
