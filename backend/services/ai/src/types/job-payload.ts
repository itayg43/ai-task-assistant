import z from "zod";

import { capabilities } from "@capabilities";
import { Capability } from "@types";

export type TCapabilityJobPayload<TCapability extends Capability> = {
  /**
   * We pass the capability name instead of CapabilityConfig because:
   * - CapabilityConfig contains functions (handler) and Zod schemas that cannot be serialized to JSON
   * - The worker will look up the config from the capabilities registry using this name
   * - This differs from sync flow which uses res.locals.capabilityConfig (already validated by middleware)
   */
  capability: TCapability;

  /**
   * This is the complete validated input, not just the body, so it can be passed directly to the capability handler as in executeSyncPattern.
   * The structure includes:
   * - params: { capability: Capability }
   * - query: { pattern: "async", callbackUrl }
   * - body: { ... } (capability-specific input)
   */
  input: z.infer<(typeof capabilities)[TCapability]["inputSchema"]>;

  /**
   * Request ID for distributed tracing.
   * This is propagated from the original request through the async flow.
   */
  requestId: string;
};
