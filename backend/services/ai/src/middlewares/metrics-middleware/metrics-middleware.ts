import {
  recordAiApiFailure,
  recordAiApiSuccess,
} from "@metrics/ai-service-metrics";
import { createMetricsMiddleware } from "@shared/middlewares/metrics";
import { Capability } from "@types";

export const aiMetricsMiddleware = createMetricsMiddleware({
  getOperation: (_req, res) => res.locals.capabilityConfig?.name ?? null,
  recorder: {
    recordSuccess: (
      capability: string,
      durationMs: number,
      requestId: string
    ) => recordAiApiSuccess(capability as Capability, durationMs, requestId),
    recordFailure: (capability: string, requestId: string) =>
      recordAiApiFailure(capability as Capability, requestId),
  },
});
