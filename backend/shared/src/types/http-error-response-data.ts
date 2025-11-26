export type HttpErrorResponseData =
  | {
      message?: string;
      [key: string]: unknown;
    }
  | undefined;
