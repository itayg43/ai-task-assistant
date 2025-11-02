import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

export const requestId = (_req: Request, res: Response, next: NextFunction) => {
  res.locals.requestId = uuidv4();

  next();
};
