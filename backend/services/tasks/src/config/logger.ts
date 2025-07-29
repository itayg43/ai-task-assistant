import { LogContext, LogLevel, Tag } from "@types";
import { exhaustiveSwitch } from "@utils/exhaustive-switch";
import { getDateISO } from "@utils/time-date";

export const createLogger = (tag: Tag) => ({
  info: (message: string, context?: LogContext) =>
    log("info", tag, message, context),
  error: (message: string, error: unknown, context?: LogContext) =>
    log("error", tag, message, context, error),
  warn: (message: string, context?: LogContext) =>
    log("warn", tag, message, context),
});

function log(
  level: LogLevel,
  tag: Tag,
  message: string,
  context?: LogContext,
  error?: unknown
) {
  const base = `[${getDateISO()}] [${level.toUpperCase()}] [${tag}]: ${message}`;

  let args: unknown[] = [];
  if (error) args.push(error);
  if (context) args.push(JSON.stringify(context, null, 2));

  exhaustiveSwitch(level, {
    info: () => console.log(base, ...args),
    error: () => console.error(base, ...args),
    warn: () => console.warn(base, ...args),
  });
}
