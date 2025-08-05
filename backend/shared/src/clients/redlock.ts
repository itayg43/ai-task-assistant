import Redis from "ioredis";
import Redlock, { Settings } from "redlock";

export const createRedlockClient = (
  redisClients: Redis[],
  settings: Pick<Settings, "retryCount" | "retryDelay" | "retryJitter">
) => {
  return new Redlock(redisClients, settings);
};
