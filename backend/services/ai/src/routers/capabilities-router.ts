import { Router } from "express";

import { executeCapability } from "@controllers/capabilities-controller";
import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { validatePromptInjection } from "@middlewares/validate-prompt-injection";

export const capabilitiesRouter = Router();

capabilitiesRouter.post(
  "/:capability",
  [
    validateExecutableCapability,
    validateCapabilityInput,
    validatePromptInjection,
  ],
  executeCapability
);
