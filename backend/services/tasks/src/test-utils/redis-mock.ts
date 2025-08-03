import Redis from "ioredis";

import { vi } from "vitest";

export const createRedisClientMock = (): Partial<Redis> => ({
  hgetall: vi.fn(),
  hmset: vi.fn(),
  expire: vi.fn(),
});
