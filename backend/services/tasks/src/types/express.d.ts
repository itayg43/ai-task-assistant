import type { AuthenticationContext, TokenUsage } from "@shared/types";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      authenticationContext?: AuthenticationContext;
      tokenUsage?: TokenUsage;
    }
  }
}
