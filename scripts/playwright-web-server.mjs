import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import { fileURLToPath } from "url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const buildIdPath = path.join(projectRoot, ".next", "BUILD_ID")
const buildSignaturePath = path.join(projectRoot, ".next", "playwright-build-signature.json")
const standaloneRoot = path.join(projectRoot, ".next", "standalone")
const standaloneServerPath = path.join(standaloneRoot, "server.js")
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"
const resolvedPort = (() => {
  try {
    const url = new URL(baseUrl)
    return url.port || (url.protocol === "https:" ? "443" : "80")
  } catch {
    return "3000"
  }
})()

const watchedEntries = [
  "src",
  "public",
  "package.json",
  "next.config.js",
  "site.config.js",
]

// NEXT_PUBLIC_SITE_URL은 site.config.js의 isProd 판정 입력이라 번들 내용을 바꾼다. signature에서
// 빠지면 production 모드를 재현하려는 e2e가 그렇지 않은 .next를 그대로 재사용한다.
const buildSignature = {
  enableQaRoutes: process.env.ENABLE_QA_ROUTES === "true",
  nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
}

const getLatestMtimeMs = (targetPath) => {
  if (!fs.existsSync(targetPath)) return 0

  const stat = fs.statSync(targetPath)
  if (!stat.isDirectory()) return stat.mtimeMs

  let latest = stat.mtimeMs
  const entries = fs.readdirSync(targetPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === ".next" || entry.name === "node_modules" || entry.name === "test-results") continue
    latest = Math.max(latest, getLatestMtimeMs(path.join(targetPath, entry.name)))
  }

  return latest
}

const resolveNeedsBuild = () => {
  if (!fs.existsSync(buildIdPath)) return true

  if (!fs.existsSync(buildSignaturePath)) return true

  try {
    const savedSignature = JSON.parse(fs.readFileSync(buildSignaturePath, "utf8"))
    if (JSON.stringify(savedSignature) !== JSON.stringify(buildSignature)) {
      return true
    }
  } catch {
    return true
  }

  const buildMtimeMs = fs.statSync(buildIdPath).mtimeMs
  const latestSourceMtimeMs = watchedEntries.reduce((maxMtime, entry) => {
    return Math.max(maxMtime, getLatestMtimeMs(path.join(projectRoot, entry)))
  }, 0)

  return latestSourceMtimeMs > buildMtimeMs
}

if (resolveNeedsBuild()) {
  const buildResult = spawnSync("yarn", ["build"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  })

  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1)
  }

  fs.mkdirSync(path.dirname(buildSignaturePath), { recursive: true })
  fs.writeFileSync(buildSignaturePath, JSON.stringify(buildSignature))
}

if (!fs.existsSync(standaloneServerPath)) {
  throw new Error("Playwright standalone server output is missing")
}

fs.cpSync(path.join(projectRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static"), {
  recursive: true,
  force: true,
})
fs.cpSync(path.join(projectRoot, "public"), path.join(standaloneRoot, "public"), {
  recursive: true,
  force: true,
})

const startResult = spawnSync(process.execPath, [standaloneServerPath], {
  cwd: standaloneRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: resolvedPort,
  },
})

process.exit(startResult.status ?? 0)
