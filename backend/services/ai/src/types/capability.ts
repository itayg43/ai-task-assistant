import { CAPABILITY } from "@constants";

export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
