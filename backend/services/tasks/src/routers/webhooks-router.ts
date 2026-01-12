import { Router } from "express";

import { createTask } from "@controllers/webhooks-controller";
import { tasksErrorHandler } from "@middlewares/tasks-error-handler";
import { createTaskWebhookInputSchema } from "@schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/create-task",
  validateSchema(createTaskWebhookInputSchema),
  createTask
);

// Domain-specific error handlers (after routes, before global error handler)
// Order matters: tasksErrorHandler must run before tokenUsageErrorHandler
// because tasksErrorHandler handles specific error types and may reconcile
// token usage, while tokenUsageErrorHandler handles ALL remaining errors
// and releases full reservation for unexpected failures
webhooksRouter.use(tasksErrorHandler);
