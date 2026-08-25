import type { NextApiRequest, NextApiResponse } from "next"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"

type MetricsRegistry = {
  contentType: string
  metrics: () => Promise<string>
}

type MetricsHandlerDependencies = {
  token: string | undefined
  registry: MetricsRegistry
}

export const createMetricsHandler = ({ token, registry }: MetricsHandlerDependencies) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET")
      return res.status(405).send("Method Not Allowed")
    }

    const configuredToken = token?.trim()
    if (!configuredToken || configuredToken.length < 32) return res.status(503).send("Service Unavailable")
    if (req.headers.authorization !== `Bearer ${configuredToken}`) return res.status(401).send("Unauthorized")

    try {
      const exposition = await registry.metrics()
      res.setHeader("Content-Type", registry.contentType)
      return res.status(200).send(exposition)
    } catch {
      return res.status(500).send("Internal Server Error")
    }
  }

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    return await createMetricsHandler({
      token: process.env.WEB_METRICS_TOKEN,
      registry: getRuntimeMetrics().registry,
    })(req, res)
  } catch {
    return res.status(500).send("Internal Server Error")
  }
}

export default handler
