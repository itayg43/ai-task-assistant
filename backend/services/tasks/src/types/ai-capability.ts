import { TOpenaiMetadata, TParseTaskConfig } from "@types";

type TAiCapabilityMap = {
  "parse-task": {
    params: {
      naturalLanguage: string;
      config: TParseTaskConfig;
    };
  };
};

export type TAiCapability = keyof TAiCapabilityMap;

export type TAiCapabilityResponse<TResult> = {
  openaiMetadata: Record<string, TOpenaiMetadata>;
  result: TResult;
  aiServiceRequestId: string;
};

export type TAiCapabilityImmediateResponse = {
  message: string;
  aiServiceRequestId: string;
};

export type TExecuteCapabilityConfig<TCapability extends TAiCapability> = {
  capability: TCapability;
  callbackUrl: string;
  params: TAiCapabilityMap[TCapability]["params"];
};
