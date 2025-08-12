import { Router } from "express";

import { executeCapability } from "@controllers/capabilities-controller";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";

export const capabilitiesRouter = Router();

capabilitiesRouter.post(
  "/:capability",
  validateExecutableCapability,
  executeCapability
);
