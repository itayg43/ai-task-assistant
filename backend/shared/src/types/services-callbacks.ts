export type ServicesCleanupCallbacks = {
  afterSuccess: () => Promise<void>;
  afterFailure: () => Promise<void>;
};

export type ServicesCallbacks = {
  startCallback: () => Promise<void>;
  cleanupCallbacks: ServicesCleanupCallbacks;
};
