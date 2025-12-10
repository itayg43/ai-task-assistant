import { AuthenticationContext } from "@shared/types";

declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
      requestId: string;
      tokenUsage?: {
        tokensReserved: number;
        windowStartTimestamp: number;
        actualTokens?: number;
      };
    }
  }
}
