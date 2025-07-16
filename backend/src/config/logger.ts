import { LOG_LEVEL } from "@constants";
import { LogContext, LogLevel, Tag } from "@types";

export const createLogger = (tag: Tag) => ({
  info: (message: string, context?: LogContext) =>
    log("info", tag, message, context),
  error: (message: string, error?: unknown) =>
    log("error", tag, message, error),
  warn: (message: string, contextOrError?: unknown) =>
    log("warn", tag, message, contextOrError),
});

function log(level: LogLevel, tag: Tag, message: string, extra?: unknown) {
  const date = new Date().toISOString();
  const base = `[${date}] [${level.toUpperCase()}] [${tag}]: ${message}`;
  const args = extra
    ? [level === LOG_LEVEL.ERROR ? extra : JSON.stringify(extra, null, 2)]
    : [];

  switch (level) {
    case LOG_LEVEL.INFO: {
      console.log(base, ...args);
      break;
    }
    case LOG_LEVEL.ERROR: {
      console.error(base, ...args);
      break;
    }
    case LOG_LEVEL.WARN: {
      console.warn(base, ...args);
      break;
    }
  }
}
