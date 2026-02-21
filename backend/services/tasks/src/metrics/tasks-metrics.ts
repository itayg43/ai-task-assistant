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

// Counter for prompt injection errors
const tasksPromptInjectionTotal = new Counter({
  name: "tasks_prompt_injection_total",
  help: "Total number of requests that failed due to prompt injection detection",
  labelNames: ["operation"], // Allows filtering by operation in queries
  registers: [register],
});

// Counter for metadata not found (expired before webhook callback)
const tasksMetadataNotFoundTotal = new Counter({
  name: "tasks_metadata_not_found_total",
  help: "Total number of webhook callbacks where metadata expired (30s TTL) - indicates token leakage or queue backlog",
  registers: [register],
});

export const recordTasksApiSuccess = (
  operation: TasksOperation,
  startTime: number,
  requestId: string,
): void => {
  try {
    const durationMs = Date.now() - startTime;
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
      durationMs,
    );

    logger.debug("Recorded tasks API success metrics", {
      requestId,
      operation,
      status,
      durationMs,
    });
  } catch (error) {
    logger.error("Failed to record tasks API success metrics", error, {
      requestId,
      operation,
    });
  }
};

export const recordTasksApiFailure = (
  operation: TasksOperation,
  requestId: string,
): void => {
  try {
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
  } catch (error) {
    logger.error("Failed to record tasks API failure metrics", error, {
      requestId,
      operation,
    });
  }
};

export const recordVagueInput = (requestId: string): void => {
  try {
    tasksVagueInputTotal.inc();

    logger.debug("Recorded vague input metric", {
      requestId,
    });
  } catch (error) {
    logger.error("Failed to record vague input metric", error, {
      requestId,
    });
  }
};

export const recordPromptInjection = (
  operation: TasksOperation,
  requestId: string,
): void => {
  try {
    tasksPromptInjectionTotal.inc({
      operation,
    });

    logger.debug("Recorded prompt injection metric", {
      requestId,
      operation,
    });
  } catch (error) {
    logger.error("Failed to record prompt injection metric", error, {
      requestId,
      operation,
    });
  }
};

export const recordMetadataNotFound = (requestId: string): void => {
  try {
    tasksMetadataNotFoundTotal.inc();

    logger.debug("Recorded metadata not found metric", {
      requestId,
    });
  } catch (error) {
    logger.error("Failed to record metadata not found metric", error, {
      requestId,
    });
  }
};
