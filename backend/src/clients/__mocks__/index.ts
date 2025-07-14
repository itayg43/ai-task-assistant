import { vi } from "vitest";

export const redis = {
  hgetall: vi.fn(),
  hmset: vi.fn(),
  expire: vi.fn(),
};

export const redlock = {
  acquire: vi.fn(),
};

export const closeRedisClient = vi.fn().mockResolvedValue(undefined);

export const destroyRedisClient = vi.fn();
