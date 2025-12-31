import { Router } from "express";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { tasksMetricsMiddleware } from "@middlewares/metrics-middleware";
import { tasksErrorHandler } from "@middlewares/tasks-error-handler";
import { tokenUsageErrorHandler } from "@middlewares/token-usage-error-handler";
import {
  openaiTokenUsageRateLimiter,
  openaiUpdateTokenUsage,
} from "@middlewares/token-usage-rate-limiter";
import { createTaskSchema, getTasksSchema } from "@schemas/tasks-schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

tasksRouter.use(tasksMetricsMiddleware);

tasksRouter.post(
  "/",
  [validateSchema(createTaskSchema), openaiTokenUsageRateLimiter.createTask],
  createTask,
  openaiUpdateTokenUsage
);
tasksRouter.get("/", [validateSchema(getTasksSchema)], getTasks);

// Handle errors: record error metrics, call reconcile token usage, sanitize errors
tasksRouter.use(tasksErrorHandler);

// Reconcile token usage reservations on any failure (before global error handler)
tasksRouter.use(tokenUsageErrorHandler);
