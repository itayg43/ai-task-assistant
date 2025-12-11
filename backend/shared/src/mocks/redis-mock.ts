import Redis from "ioredis";
import { vi } from "vitest";

export const createRedisClientMock = (): Redis =>
  ({
    hgetall: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
    hincrby: vi.fn(),
  } as unknown as Redis);
