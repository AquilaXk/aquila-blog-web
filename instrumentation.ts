export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeRuntimeMetricsForNode } = await import("./instrumentation.node")
    await initializeRuntimeMetricsForNode()
  }
}
