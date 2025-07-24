import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as z from "zod";

import { createLogger } from "@config/logger";

const logger = createLogger("validateSchema");

export const validateSchema =
  (schema: z.ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info("Validate schema", {
        input: {
          body: req.body,
        },
      });

      const parsed = schema.parse(req) as any;

      Object.assign(req.body, parsed.body);

      logger.info("Validate schema succeeded", {
        parsed,
      });

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Validate schema failed", error);

        res.status(StatusCodes.BAD_REQUEST).json({
          message: formatZodErrors(error),
        });
      } else {
        // Pass Error to error handler
        next(error);
      }
    }
  };

function formatZodErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}
