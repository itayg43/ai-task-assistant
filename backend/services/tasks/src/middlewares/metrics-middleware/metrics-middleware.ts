import {
  recordTasksApiFailure,
  recordTasksApiSuccess,
} from "@metrics/tasks-metrics";
import { createMetricsMiddleware } from "@shared/middlewares/metrics";
import { TasksOperation } from "@types";

export const tasksMetricsMiddleware = createMetricsMiddleware({
  operationsMap: {
    POST: "create_task",
    GET: "get_tasks",
  },
  recorder: {
    recordSuccess: (operation: string, durationMs: number, requestId: string) =>
      recordTasksApiSuccess(operation as TasksOperation, durationMs, requestId),
    recordFailure: (operation: string, durationMs: number, requestId: string) =>
      recordTasksApiFailure(operation as TasksOperation, durationMs, requestId),
  },
});
