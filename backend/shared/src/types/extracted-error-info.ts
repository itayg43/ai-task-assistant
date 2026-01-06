export type ExtractedErrorInfo = {
  status: number;
  message: string;
  context?: Record<string, unknown>;
};
