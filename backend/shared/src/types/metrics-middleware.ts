export type OperationsMap = Record<string, string>; // e.g., { "POST": "create_task", "GET": "get_tasks" }

export type MetricsRecorder = {
  recordSuccess: (
    operation: string,
    durationMs: number,
    requestId: string
  ) => void;
  recordFailure: (
    operation: string,
    durationMs: number,
    requestId: string
  ) => void;
};

export type CreateMetricsMiddlewareOptions = {
  operationsMap: OperationsMap;
  recorder: MetricsRecorder;
};
