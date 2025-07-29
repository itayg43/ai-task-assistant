import { NextFunction, Request, Response } from "express";

export const authentication = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Replace with actual authentication logic (JWT, session, etc.)
  // This is a hardcoded user ID for development purposes only
  const userId = 1;

  res.locals.authenticationContext = {
    userId,
  };

  next();
};
