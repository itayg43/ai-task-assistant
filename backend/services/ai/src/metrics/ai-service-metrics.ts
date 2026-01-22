import { Counter, Histogram, register } from "@shared/clients/prom";
import { createLogger } from "@shared/config/create-logger";

import { Capability } from "@types";

const logger = createLogger("aiServiceMetrics");

// Counter for total requests - labeled by capability and status
const aiApiRequestsTotal = new Counter({
  name: "ai_api_requests_total",
  help: "Total number of AI API requests",
  labelNames: ["capability", "status"], // capability: "parse-task"
  registers: [register],
});

// Histogram for request duration
// Bucket selection rationale:
//   - AI service calls include OpenAI API time + pre/post processing
//   - OpenAI calls typically take 1500-3000ms
//   - Full request lifecycle adds ~100-500ms overhead
//   - 500-1000ms: Very fast responses (edge cases)
//   - 1500-4000ms: Typical AI request range
//   - 5000-10000ms: Slow operations that may indicate issues
//   - 15000ms+: Timeout territory
const aiApiRequestDurationMs = new Histogram({
  name: "ai_api_request_duration_ms",
  help: "Duration of AI API requests in milliseconds",
  labelNames: ["capability", "status"],
  buckets: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000],
  registers: [register],
});

// Helper functions with debug logging

export const recordAiApiSuccess = (
  capability: Capability,
  durationMs: number,
  requestId: string
): void => {
  const status = "success";

  aiApiRequestsTotal.inc({
    capability,
    status,
  });
  aiApiRequestDurationMs.observe(
    {
      capability,
      status,
    },
    durationMs
  );

  logger.debug("Recorded AI API success metrics", {
    requestId,
    capability,
    status,
    durationMs,
  });
};

export const recordAiApiFailure = (
  capability: Capability,
  requestId: string
): void => {
  const status = "failure";

  aiApiRequestsTotal.inc({
    capability,
    status,
  });

  logger.debug("Recorded AI API failure metrics", {
    requestId,
    capability,
    status,
  });
};
