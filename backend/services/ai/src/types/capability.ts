import { CAPABILITY } from "@shared/constants";

export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
