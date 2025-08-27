import { CAPABILITY } from "../constants/capability";

export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
