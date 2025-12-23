import { NextFunction, Request, Response } from "express";

import { getCapabilityConfig } from "@utils/get-capability-config";
import { getCapabilityValidatedInput } from "@utils/get-capability-validated-input";
import { detectInjection } from "@utils/prompt-injection-detector";

/**
 *
 * Example with "body.naturalLanguage":
 *   Input object:
 *   {
 *     body: { naturalLanguage: "Submit Q2 report" }
 *   }
 *
 *   getNestedValue(obj, "body.naturalLanguage")
 *
 *   Step 1: "body.naturalLanguage".split(".") → ["body", "naturalLanguage"]
 *   Step 2: reduce iteration 1: current = obj, key = "body"
 *           → obj?.["body"] = { naturalLanguage: "Submit Q2 report" }
 *   Step 3: reduce iteration 2: current = { naturalLanguage: "..." }, key = "naturalLanguage"
 *           → { naturalLanguage: "..." }?.["naturalLanguage"] = "Submit Q2 report"
 *   Result: "Submit Q2 report"
 *
 */
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

export const validatePromptInjection = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestId = res.locals.requestId;
    const { promptInjectionFields: fieldsToCheck } = getCapabilityConfig(res);
    const validatedInput = getCapabilityValidatedInput(res);

    if (fieldsToCheck.length === 0) {
      next();

      return;
    }

    for (const fieldPath of fieldsToCheck) {
      const fieldValue = getNestedValue(validatedInput, fieldPath);

      if (typeof fieldValue === "string") {
        detectInjection(fieldValue, requestId);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
