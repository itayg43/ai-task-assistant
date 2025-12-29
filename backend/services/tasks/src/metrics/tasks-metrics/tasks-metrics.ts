import { Counter, Histogram, register } from "@shared/clients/prom";
import { createLogger } from "@shared/config/create-logger";
import { TasksOperation } from "@types";

const logger = createLogger("tasksMetrics");

// Counter for total requests - labeled by operation and status
const tasksApiRequestsTotal = new Counter({
  name: "tasks_api_requests_total",
  help: "Total number of Tasks API requests",
  labelNames: ["operation", "status"], // operation: "create_task" | "get_tasks"
  registers: [register],
});

// Histogram for request duration
// Bucket selection rationale (based on initial estimates):
//   - GET tasks: Fast DB queries (500-1000ms typical)
//   - CREATE task: AI service call (~2500-3000ms) + DB operations
//   - 500-1000ms: Fast GET operations
//   - 2500-5000ms: Typical CREATE task range (AI + DB)
//   - 7500-15000ms: Slow operations that may indicate issues
const tasksApiRequestDurationMs = new Histogram({
  name: "tasks_api_request_duration_ms",
  help: "Duration of Tasks API requests in milliseconds",
  labelNames: ["operation", "status"],
  buckets: [500, 1000, 2500, 3000, 4000, 5000, 7500, 10000, 15000],
  registers: [register],
});

// Counter for vague input errors (subset of create_task failures)
const tasksVagueInputTotal = new Counter({
  name: "tasks_vague_input_total",
  help: "Total number of create task requests that failed due to vague input",
  registers: [register],
});

// Helper functions with debug logging (following openai-metrics pattern)

export const recordTasksApiSuccess = (
  operation: TasksOperation,
  durationMs: number,
  requestId: string
): void => {
  const status = "success";

  tasksApiRequestsTotal.inc({
    operation,
    status,
  });
  tasksApiRequestDurationMs.observe(
    {
      operation,
      status,
    },
    durationMs
  );

  logger.debug("Recorded tasks API success metrics", {
    requestId,
    operation,
    status,
    durationMs,
  });
};

export const recordTasksApiFailure = (
  operation: TasksOperation,
  requestId: string
): void => {
  const status = "failure";

  tasksApiRequestsTotal.inc({
    operation,
    status,
  });

  logger.debug("Recorded tasks API failure metrics", {
    requestId,
    operation,
    status,
  });
};

export const recordVagueInput = (requestId: string): void => {
  tasksVagueInputTotal.inc();

  logger.debug("Recorded vague input metric", {
    requestId,
  });
};
