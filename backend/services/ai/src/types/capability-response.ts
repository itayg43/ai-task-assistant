export type CapabilityResponse<T> = {
  metadata: {
    tokens: {
      input?: number;
      output?: number;
    };
    duration: number;
  };
  result: T;
};
