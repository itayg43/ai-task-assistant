import { AuthenticationContext } from "./authentication-context";
import { TokenUsage } from "./token-usage";

declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
      requestId?: string;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
      tokenUsage?: TokenUsage;
    }
  }
}
