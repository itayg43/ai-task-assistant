import { LOG_LEVEL } from "@shared/constants";

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];
