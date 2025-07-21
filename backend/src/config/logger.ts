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
    ? [level === "error" ? extra : JSON.stringify(extra, null, 2)]
    : [];

  switch (level) {
    case "info": {
      console.log(base, ...args);
      break;
    }
    case "error": {
      console.error(base, ...args);
      break;
    }
    case "warn": {
      console.warn(base, ...args);
      break;
    }
    default: {
      // This ensures all cases are handled. If a new value is added to the union type,
      // TypeScript will error here until you handle it above.
      const _exhaustiveCheck: never = level;
      throw new Error(`Unhandled log level: ${level}`);
    }
  }
}
