export type RequestMetadata = {
  userId: number;
  tokensReserved: number;
  windowStartTimestamp: number;
  startTime: number;
  serviceName: string;
  rateLimiterName: string;
};
