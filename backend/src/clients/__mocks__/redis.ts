import { vi } from "vitest";

export const redis = {
  hgetall: vi.fn(),
  hmset: vi.fn(),
  expire: vi.fn(),
};

export const closeRedisClient = vi.fn();
export const destroyRedisClient = vi.fn();
