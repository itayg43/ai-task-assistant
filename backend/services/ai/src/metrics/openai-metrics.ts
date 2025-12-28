import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { Counter, Histogram } from "prom-client";

import { register } from "@clients/prom";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("openai-metrics");

// Counter for total API requests
// Tracks success and failure counts to calculate success rate
// Labels: capability (e.g., "parse-task"), operation (e.g., "core", "subtasks"), status ("success" | "failure")
export const openaiApiRequestsTotal = new Counter({
  name: "openai_api_requests_total",
  help: "Total number of OpenAI API requests",
  labelNames: ["capability", "operation", "status"],
  registers: [register],
});

// Histogram for request duration (automatically calculates percentiles)
// Tracks average and P95 duration (P99 can be calculated if needed)
// Labels: capability, operation, status
// Buckets: [1000, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000] milliseconds
// Bucket selection rationale:
//   - Minimum observed duration is ~2500ms, so buckets start at 1000ms
//   - 2000-3000ms: Typical response times
//   - 4000-5000ms: Slower but acceptable responses
//   - 7500-10000ms: Slow responses that may indicate issues
//   - 15000ms: Very slow responses (timeout territory)
//   - +Inf bucket is automatically added by prom-client
// P95 is the primary percentile tracked for performance monitoring
export const openaiApiRequestDurationMs = new Histogram({
  name: "openai_api_request_duration_ms",
  help: "Duration of OpenAI API requests in milliseconds",
  labelNames: ["capability", "operation", "status"],
  buckets: [1000, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000],
  registers: [register],
});

// Counter for total token usage
// Tracks total tokens consumed (not average - average can be derived)
// Useful for cost tracking, usage trends, and rate calculations
// Labels: capability, operation, type ("input" | "output"), model (e.g., "gpt-4.1-mini")
// Model label enables cost calculation in Grafana using model-specific pricing
// Note: Average tokens per request can be calculated as:
//   sum(rate(openai_api_tokens_total[5m])) / sum(rate(openai_api_requests_total[5m]))
export const openaiApiTokensTotal = new Counter({
  name: "openai_api_tokens_total",
  help: "Total tokens used in OpenAI API requests",
  labelNames: ["capability", "operation", "type", "model"],
  registers: [register],
});

export const recordOpenAiApiSuccessMetrics = (
  capability: string,
  operation: string,
  model: ResponseCreateParamsNonStreaming["model"],
  durationMs: number,
  inputTokens: number,
  outputTokens: number,
  requestId: string
): void => {
  const status = "success";

  openaiApiRequestsTotal.inc({
    capability,
    operation,
    status,
  });
  openaiApiRequestDurationMs.observe(
    {
      capability,
      operation,
      status,
    },
    durationMs
  );
  openaiApiTokensTotal.inc(
    {
      capability,
      operation,
      type: "input",
      model,
    },
    inputTokens
  );
  openaiApiTokensTotal.inc(
    {
      capability,
      operation,
      type: "output",
      model,
    },
    outputTokens
  );

  logger.debug("Recorded OpenAI API success metrics", {
    requestId,
    capability,
    operation,
    model,
    status,
    durationMs,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  });
};

export const recordOpenAiApiFailureMetrics = (
  capability: string,
  operation: string,
  requestId: string
): void => {
  const status = "failure";

  openaiApiRequestsTotal.inc({
    capability,
    operation,
    status,
  });

  logger.debug("Recorded OpenAI API failure metrics", {
    requestId,
    capability,
    operation,
    status,
  });
};
