import { CAPABILITY_PATTERN } from "@shared/constants";

export type CapabilityPattern =
  (typeof CAPABILITY_PATTERN)[keyof typeof CAPABILITY_PATTERN];
