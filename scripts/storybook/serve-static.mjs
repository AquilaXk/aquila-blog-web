import http from "node:http"
import { open } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const staticRoot = path.join(projectRoot, "storybook-static")
const host = "127.0.0.1"
const port = Number(process.env.STORYBOOK_STATIC_PORT || "6006")
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

const send = (response, statusCode, body, contentType = "text/plain; charset=utf-8") => {
  response.writeHead(statusCode, { "content-type": contentType })
  response.end(body)
}

const resolveStaticPath = (requestUrl) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(requestUrl, `http://${host}`).pathname)
  } catch {
    return null
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1)
  const resolvedPath = path.resolve(staticRoot, relativePath)
  if (!resolvedPath.startsWith(`${staticRoot}${path.sep}`)) return null

  return resolvedPath
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed")
    return
  }

  const targetPath = resolveStaticPath(request.url || "/")
  if (!targetPath) {
    send(response, 403, "Forbidden")
    return
  }

  let handle
  try {
    handle = await open(targetPath, "r")
    if (!(await handle.stat()).isFile()) {
      send(response, 404, "Not found")
      return
    }

    const contentType = mimeTypes[path.extname(targetPath)] || "application/octet-stream"
    response.writeHead(200, { "content-type": contentType })
    if (request.method === "HEAD") {
      response.end()
      return
    }

    response.end(await handle.readFile())
  } catch {
    send(response, 404, "Not found")
  } finally {
    if (handle) await handle.close()
  }
})

const closeServer = () => server.close(() => process.exit(0))
process.once("SIGINT", closeServer)
process.once("SIGTERM", closeServer)

server.listen(port, host, () => {
  console.log(`[storybook-static] listening on http://${host}:${port}`)
})
