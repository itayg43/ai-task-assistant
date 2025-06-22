import { createLogger, format, transports } from "winston";

import { LogMeta } from "../types/log-meta";

const baseLogger = createLogger({
  level: "info",
  format: format.combine(
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
