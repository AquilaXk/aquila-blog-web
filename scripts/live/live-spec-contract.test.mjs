import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const frontRoot = path.resolve(import.meta.dirname, "../..")

test("live gate pins credential-free public and unauthenticated checks", () => {
  const liveSpec = readFileSync(path.join(frontRoot, "e2e/live.spec.ts"), "utf8")
  const runner = readFileSync(path.join(frontRoot, "scripts/run-live-e2e.mjs"), "utf8")
  const source = [liveSpec, runner].join("\n")

  assert.match(liveSpec, /page\.request\.get\("\/feed"\)[\s\S]*?application\/rss\+xml/)
  assert.match(liveSpec, /post\/api\/v1\/posts\/search/)
  assert.match(
    liveSpec,
    /const webOrigin = new URL\(process\.env\.PLAYWRIGHT_BASE_URL \|\| page\.url\(\)\)\.origin[\s\S]*?new URL\("\/actuator\/health\/readiness", webOrigin\)/
  )
  assert.match(
    liveSpec,
    /new URL\("\/post\/api\/v1\/posts\/images", webOrigin\)[\s\S]*?access-control-allow-origin"\]\)\.toBeUndefined\(\)/
  )
  assert.doesNotMatch(liveSpec, /access-control-allow-credentials/)
  assert.match(liveSpec, /page\.goto\("\/admin"\)[\s\S]*?toHaveURL\(\/\\\/admin\\\/login\//)
  assert.match(liveSpec, /test\.skip\(!expectedFrontendCommitSha, "E2E_EXPECTED_FRONT_COMMIT_SHA is required"\)/)
  assert.match(runner, /target: "live-ready"/)
  assert.match(runner, /const liveSpecs = \["e2e\/live\.spec\.ts"\]/)

  assert.doesNotMatch(source, /E2E_(?:LIVE_)?ADMIN_(?:EMAIL|USERNAME|PASSWORD)/)
  assert.doesNotMatch(source, /\/member\/api\/v1\/auth\/login/)
  assert.doesNotMatch(source, /buildLoginPayloadCandidates|hasAuthCookie|loginWithRetry|password/i)
  for (const retiredPath of ["e2e/helpers/liveAuth.ts", "e2e/editor-live-visual.spec.ts", "e2e/live-auth-helper.spec.ts"]) {
    assert.equal(existsSync(path.join(frontRoot, retiredPath)), false, retiredPath)
  }
})
