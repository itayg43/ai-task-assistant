import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validateSchema =
  (schema: z.AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req) as any;

      req.body = parsed.body;

      next();
    } catch (error) {
      next(error);
    }
  };
