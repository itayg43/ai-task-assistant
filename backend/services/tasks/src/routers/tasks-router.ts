import { Router } from "express";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { validateSchema } from "@shared/middlewares/validate-schema";
import { createTaskSchema, getTasksSchema } from "@schemas/tasks-schemas";

export const tasksRouter = Router();

tasksRouter.post("/", [validateSchema(createTaskSchema)], createTask);
tasksRouter.get("/", [validateSchema(getTasksSchema)], getTasks);
