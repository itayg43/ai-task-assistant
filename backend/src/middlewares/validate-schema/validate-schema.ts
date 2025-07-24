import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as z from "zod";

import { createLogger } from "@config/logger";

const logger = createLogger("validateSchema");

export const validateSchema =
  (schema: z.ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req) as {
        body: any;
        query: any;
        params: any;
      };

      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;

      next();
    } catch (error) {
      logger.error("Validate schema failed", error);

      if (error instanceof z.ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: formatZodErrors(error),
        });
      } else {
        next(error);
      }
    }
  };

function formatZodErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
    .join("; ");
}
