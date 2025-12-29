import { Request, Response } from "express";

export type OperationsMap = Record<string, string>; // e.g., { "POST": "create_task", "GET": "get_tasks" }

export type OperationResolver = (req: Request, res: Response) => string | null;

export type MetricsRecorder = {
  recordSuccess: (
    operation: string,
    durationMs: number,
    requestId: string
  ) => void;
  recordFailure: (operation: string, requestId: string) => void;
};

/**
 * Options for creating a metrics middleware.
 * Either `operationsMap` or `getOperation` must be provided, but not both.
 *
 * @example Static operations (Tasks service pattern):
 * ```ts
 * createMetricsMiddleware({
 *   operationsMap: { POST: "create_task", GET: "get_tasks" },
 *   recorder: { recordSuccess, recordFailure }
 * })
 * ```
 *
 * @example Dynamic operations (AI service pattern):
 * ```ts
 * createMetricsMiddleware({
 *   getOperation: (req, res) => res.locals.capabilityConfig?.name ?? null,
 *   recorder: { recordSuccess, recordFailure }
 * })
 * ```
 */
export type CreateMetricsMiddlewareOptions =
  | {
      operationsMap: OperationsMap;
      recorder: MetricsRecorder;
    }
  | {
      getOperation: OperationResolver;
      recorder: MetricsRecorder;
    };
