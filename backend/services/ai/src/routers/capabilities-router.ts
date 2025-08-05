import { Router } from "express";

import { parseTaskInputSchema } from "@capabilities/parse-task/parse-task-schemas";
import { parseTask } from "@controllers/capabilities-controller";
import { validateSchema } from "@shared/middlewares/validate-schema";

export const capabilitiesRouter = Router();

capabilitiesRouter.post(
  "/parse-task",
  [validateSchema(parseTaskInputSchema)],
  parseTask
);
