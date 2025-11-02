import { CapabilityConfig } from "@types";

declare global {
  namespace Express {
    interface Locals {
      capabilityConfig?: CapabilityConfig<any, Record<string, unknown>>;
      requestId: string;
    }
  }
}
