import { Response } from "express";

import { AuthenticationError } from "@errors";

export const getAuthenticationContext = (res: Response) => {
  const context = res.locals.authenticationContext;

  if (!context) {
    throw new AuthenticationError("Authentication context is missing");
  }

  return context;
};
