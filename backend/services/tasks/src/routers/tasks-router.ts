import { Router } from "express";

import { openaiTokenUsageRateLimiter } from "@middlewares/token-usage-rate-limiter";
import { createTask, getTasks } from "@controllers/tasks-controller";
import { createTaskRequestInputSchema, getTasksInputSchema } from "@schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

tasksRouter.post(
  "/",
  [validateSchema(createTaskRequestInputSchema), openaiTokenUsageRateLimiter.createTask],
  createTask
);

tasksRouter.get("/", [validateSchema(getTasksInputSchema)], getTasks);
