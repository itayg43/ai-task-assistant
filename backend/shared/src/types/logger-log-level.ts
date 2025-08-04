import { LOGGER_LOG_LEVEL } from "../constants";

export type LoggerLogLevel =
  (typeof LOGGER_LOG_LEVEL)[keyof typeof LOGGER_LOG_LEVEL];
