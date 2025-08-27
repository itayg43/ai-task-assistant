import { CAPABILITY_PATTERN } from "../constants/capability-pattern";

export type CapabilityPattern =
  (typeof CAPABILITY_PATTERN)[keyof typeof CAPABILITY_PATTERN];
