import { Router } from "express";

import { createTask } from "@controllers/webhooks-controller";
import { createTaskWebhookInputSchema } from "@schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/create-task",
  validateSchema(createTaskWebhookInputSchema),
  createTask
);
