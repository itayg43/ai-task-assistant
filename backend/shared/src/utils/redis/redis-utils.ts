import Redis from "ioredis";

export const incrementHashField = async (
  redisClient: Redis,
  key: string,
  field: string,
  amount: number
): Promise<number> => {
  return await redisClient.hincrby(key, field, amount);
};

export const decrementHashField = async (
  redisClient: Redis,
  key: string,
  field: string,
  amount: number
): Promise<number> => {
  return await redisClient.hincrby(key, field, -amount);
};
