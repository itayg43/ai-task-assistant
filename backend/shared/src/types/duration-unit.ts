import { DURATION_UNIT } from "../constants";

export type DurationUnit = (typeof DURATION_UNIT)[keyof typeof DURATION_UNIT];
