import { Router } from "express";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { tasksErrorHandler } from "@middlewares/tasks-error-handler";
import {
  createTaskInputSchema,
  getTasksInputSchema,
} from "@schemas/tasks-schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

// tasksRouter.use(tasksMetricsMiddleware);

tasksRouter.post(
  "/",
  [validateSchema(createTaskInputSchema)], // openaiTokenUsageRateLimiter.createTask
  createTask
  // openaiUpdateTokenUsage
);
tasksRouter.get("/", [validateSchema(getTasksInputSchema)], getTasks);

// Domain-specific error handlers (after routes, before global error handler)
// Order matters: tasksErrorHandler must run before tokenUsageErrorHandler
// because tasksErrorHandler handles specific error types and may reconcile
// token usage, while tokenUsageErrorHandler handles ALL remaining errors
// and releases full reservation for unexpected failures
tasksRouter.use(tasksErrorHandler);

// Reconcile token usage reservations on any failure (before global error handler)
// This handler runs after tasksErrorHandler to catch any errors that weren't
// already handled, ensuring token reservations are always released
// tasksRouter.use(tokenUsageErrorHandler);
