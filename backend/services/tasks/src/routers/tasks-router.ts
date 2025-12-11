import { Router } from "express";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { tokenUsageErrorHandler } from "@middlewares/token-usage-error-handler";
import {
  openaiTokenUsageRateLimiter,
  openaiUpdateTokenUsage,
} from "@middlewares/token-usage-rate-limiter";
import { createTaskSchema, getTasksSchema } from "@schemas/tasks-schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

tasksRouter.post(
  "/",
  [validateSchema(createTaskSchema), openaiTokenUsageRateLimiter.createTask],
  createTask,
  openaiUpdateTokenUsage
);
tasksRouter.get("/", [validateSchema(getTasksSchema)], getTasks);

// Reconcile token usage reservations on any failure (before global error handler)
tasksRouter.use(tokenUsageErrorHandler);
