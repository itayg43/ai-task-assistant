import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validateSchema =
  (schema: z.AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req);

      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }

      if (parsed.query !== undefined) {
        res.locals.validatedQuery = parsed.query;
      }

      if (parsed.params !== undefined) {
        res.locals.validatedParams = parsed.params;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
