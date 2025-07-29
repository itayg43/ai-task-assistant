import { Router } from "express";

import { tasksRouter } from "@modules/tasks/tasks-router";

export const apiV1Router = Router();

apiV1Router.use("/tasks", tasksRouter);
