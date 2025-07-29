import { AuthenticationContext } from "./authentication-context";

declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
    }
  }
}
