import { LogContext, LogLevel, Tag } from "@types";
import { exhaustiveSwitch } from "@utils/exhaustive-switch";
import { getDateISO } from "@utils/time-date";

export const createLogger = (tag: Tag) => ({
  info: (message: string, context?: LogContext) =>
    log("info", tag, message, context),
  error: (message: string, error?: unknown) =>
    log("error", tag, message, error),
  warn: (message: string, contextOrError?: unknown) =>
    log("warn", tag, message, contextOrError),
});

function log(level: LogLevel, tag: Tag, message: string, extra?: unknown) {
  const base = `[${getDateISO()}] [${level.toUpperCase()}] [${tag}]: ${message}`;

  let args: unknown[] = [];

  if (extra) {
    args = extra instanceof Error ? [extra] : [JSON.stringify(extra, null, 2)];
  }

  exhaustiveSwitch(level, {
    info: () => console.log(base, ...args),
    error: () => console.error(base, ...args),
    warn: () => console.warn(base, ...args),
  });
}
