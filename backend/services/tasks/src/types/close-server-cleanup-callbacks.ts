export type CloseServerCleanupCallbacks = {
  afterSuccess: () => Promise<void>;
  afterFailure: () => void;
};
