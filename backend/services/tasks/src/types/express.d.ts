import type { AuthenticationContext } from "@shared/types";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      authenticationContext?: AuthenticationContext;
      tokenUsage?: {
        tokensReserved: number;
        windowStartTimestamp: number;
      };
    }
  }
}
