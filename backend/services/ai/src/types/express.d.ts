import { CapabilityConfig } from "@types";

declare global {
  namespace Express {
    interface Locals {
      capabilityConfig?: CapabilityConfig<any, any>;
    }
  }
}
