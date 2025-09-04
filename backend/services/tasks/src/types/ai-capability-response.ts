export type AiCapabilityResponse<T> = {
  metadata: {
    tokens: {
      input: number;
      output: number;
    };
    durationMs: number;
  };
  result: T;
};
