import { initializeRuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { registerServerApiFetchMetrics } from "src/libs/server/apiFetchMetrics"

export const initializeRuntimeMetricsForNode = async () => {
  initializeRuntimeMetrics()
  registerServerApiFetchMetrics()
}
