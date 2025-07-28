import { Router } from "express";

import { validateSchema } from "@middlewares/validate-schema";
import { createTask } from "@modules/tasks/tasks-controller";
import { createTaskInputSchema } from "@modules/tasks/tasks-schemas";

export const tasksRouter = Router();

tasksRouter.post(
  "/create",
  [validateSchema(createTaskInputSchema)],
  createTask
);
