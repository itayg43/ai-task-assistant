import { capabilities } from "@capabilities";

export type AnyCapabilityConfig =
  (typeof capabilities)[keyof typeof capabilities];
