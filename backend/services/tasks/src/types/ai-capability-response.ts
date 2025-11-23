export type AiCapabilityResponse<T> = {
  openaiMetadata: Record<
    string,
    {
      responseId: string;
      tokens: {
        input: number;
        output: number;
      };
      durationMs: number;
    }
  >;
  result: T;
  aiServiceRequestId: string;
};
