import { Router } from "express";

import { createTask } from "@controllers/tasks-controller";
import { validateSchema } from "@shared/middlewares/validate-schema";
import { createTaskSchema } from "@schemas/tasks-schemas";

export const tasksRouter = Router();

tasksRouter.post("/create", [validateSchema(createTaskSchema)], createTask);
