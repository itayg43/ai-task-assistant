export type WithMetricsOptions = {
  operation: string;
  requestId: string;
  onRecordSuccess: (
    operation: string,
    durationMs: number,
    requestId: string,
  ) => void;
  onRecordFailure: (operation: string, requestId: string) => void;
};
