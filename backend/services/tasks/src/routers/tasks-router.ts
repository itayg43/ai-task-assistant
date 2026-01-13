import { Router } from "express";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { createTaskRequestInputSchema, getTasksInputSchema } from "@schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

tasksRouter.post(
  "/",
  [validateSchema(createTaskRequestInputSchema)],
  createTask
);

tasksRouter.get("/", [validateSchema(getTasksInputSchema)], getTasks);
