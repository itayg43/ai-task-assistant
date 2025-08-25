import { env } from "@config/env";
import {
  closeRedisClient as close,
  connectRedisClient as connect,
  createRedisClient,
  destroyRedisClient as destroy,
} from "@shared/clients/redis";

export const redis = createRedisClient(env.REDIS_URL, {
  connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
});

export const connectRedisClient = async () => {
  await connect(redis, env.REDIS_READY_TIMEOUT_MS);
};

export const closeRedisClient = async () => {
  await close(redis);
};

export const destroyRedisClient = () => {
  destroy(redis);
};
