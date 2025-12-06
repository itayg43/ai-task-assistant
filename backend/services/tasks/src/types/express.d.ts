import { AuthenticationContext } from "@shared/types";

declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
      requestId: string;
    }
  }
}
