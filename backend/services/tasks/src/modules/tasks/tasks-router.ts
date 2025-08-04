import { Router } from "express";

import { createTask } from "@modules/tasks/tasks-controller";
import { createTaskSchema } from "@modules/tasks/tasks-schemas";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const tasksRouter = Router();

tasksRouter.post("/create", [validateSchema(createTaskSchema)], createTask);
