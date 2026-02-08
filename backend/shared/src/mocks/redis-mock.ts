import Redis from "ioredis";
import { vi } from "vitest";

export const createRedisClientMock = (): Redis =>
  ({
    hgetall: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    hincrby: vi.fn(),
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  } as unknown as Redis);
