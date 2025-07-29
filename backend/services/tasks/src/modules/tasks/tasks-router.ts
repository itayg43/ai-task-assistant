import { Router } from "express";

import { validateSchema } from "@middlewares/validate-schema";
import { createTask } from "@modules/tasks/tasks-controller";
import { createTaskSchema } from "@modules/tasks/tasks-schemas";

export const tasksRouter = Router();

tasksRouter.post("/create", [validateSchema(createTaskSchema)], createTask);
