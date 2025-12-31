import { Router } from "express";

import { executeCapability } from "@controllers/capabilities-controller";
import { aiMetricsMiddleware } from "@middlewares/metrics-middleware";
import { validateCapabilityInput } from "@middlewares/validate-capability-input";
import { validateExecutableCapability } from "@middlewares/validate-executable-capability";
import { validatePromptInjection } from "@middlewares/validate-prompt-injection";

export const capabilitiesRouter = Router();

capabilitiesRouter.post(
  "/:capability",
  [
    validateExecutableCapability, // Sets res.locals.capabilityConfig
    aiMetricsMiddleware, // Uses res.locals.capabilityConfig.name for operation
    validateCapabilityInput,
    validatePromptInjection,
  ],
  executeCapability
);
