export type CloseServerCleanupCallbacks = {
  afterSuccess: () => Promise<void>;
  afterFailure: () => Promise<void>;
};
