import { Tag } from "@types";
import { vi } from "vitest";

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

export const createLogger = vi.fn((_tag: Tag) => logger);
