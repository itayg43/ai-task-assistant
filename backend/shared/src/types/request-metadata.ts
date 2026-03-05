export type RequestMetadata = {
  requestId: string;
  userId: number;
  tokensReserved: number;
  windowStartTimestamp: number;
  startTime: number;
  serviceName: string;
  rateLimiterName: string;
};
