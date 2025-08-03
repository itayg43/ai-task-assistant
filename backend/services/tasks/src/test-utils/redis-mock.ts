import Redis from "ioredis";

import { vi } from "vitest";

export const createRedisClientMock = (): Redis =>
  ({
    hgetall: vi.fn(),
    hmset: vi.fn(),
    expire: vi.fn(),
  } as unknown as Redis);
