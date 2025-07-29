import { LOG_LEVEL } from "@constants";

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];
