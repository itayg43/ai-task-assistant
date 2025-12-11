import { AuthenticationContext } from "./authentication-context";

declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
      requestId?: string;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
      tokenUsage?: {
        tokensReserved: number;
        windowStartTimestamp: number;
        actualTokens?: number;
      };
    }
  }
}
