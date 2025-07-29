import { vi } from "vitest";

import { Tag } from "@types";

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

export const createLogger = vi.fn((_tag: Tag) => logger);
