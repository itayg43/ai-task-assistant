import { createLogger, format, transports } from "winston";

import { LogMeta } from "../types/log-meta";

const errorSerializer = format((info) => {
  function serialize(obj: any): any {
    if (obj instanceof Error) {
      return {
        ...obj,
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      };
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        obj[key] = serialize(obj[key]);
      }
    }

    return obj;
  }

  if (info) {
    for (const key of Object.keys(info)) {
      info[key] = serialize(info[key]);
    }
  }

  return info;
});

const baseLogger = createLogger({
  level: "info",
  format: format.combine(
    errorSerializer(),
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message, tag, ...meta }) => {
      const tagString = tag ? `[${tag}]` : "";
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";

      return `[${timestamp}] [${level}] ${tagString}: ${message} ${metaString}`;
    })
  ),
  transports: [new transports.Console()],
});

const logger = (tag: string) => ({
  info: (message: string, meta?: LogMeta) =>
    baseLogger.info(message, {
      tag,
      ...meta,
    }),
  error: (message: string, meta?: LogMeta) =>
    baseLogger.error(message, {
      tag,
      ...meta,
    }),
});

export default logger;
