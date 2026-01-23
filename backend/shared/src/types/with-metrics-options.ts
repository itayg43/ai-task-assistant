export type WithMetricsOptions<TOperation extends string = string> = {
  operation: TOperation;
  requestId: string;
  onRecordSuccess: (
    operation: TOperation,
    durationMs: number,
    requestId: string,
  ) => void;
  onRecordFailure: (operation: TOperation, requestId: string) => void;
};
