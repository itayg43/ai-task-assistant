import { Router } from "express";

import { executeCapability } from "@controllers/capabilities-controller";
import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";

export const capabilitiesRouter = Router();

capabilitiesRouter.post(
  "/:capability",
  [validateExecutableCapability, validateCapabilityInput],
  executeCapability
);
