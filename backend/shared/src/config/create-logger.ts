import { LoggerLogContext, LoggerLogLevel } from "../types";
import { getDateISO } from "../utils/date-time";
import { exhaustiveSwitch } from "../utils/exhaustive-switch";

export const createLogger = (tag: string) => ({
  info: (message: string, context?: LoggerLogContext) =>
    log("info", tag, message, context),
  error: (message: string, error: unknown, context?: LoggerLogContext) =>
    log("error", tag, message, context, error),
  warn: (message: string, context?: LoggerLogContext) =>
    log("warn", tag, message, context),
});

function log(
  level: LoggerLogLevel,
  tag: string,
  message: string,
  context?: LoggerLogContext,
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
