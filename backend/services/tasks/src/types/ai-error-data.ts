import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
import { TOpenaiMetadata } from "@types";

type TBaseAiErrorData = {
  message: string;
};

export type TAiErrorData = TBaseAiErrorData &
  (
    | {
        type?: undefined;
      }
    | {
        type: typeof PARSE_TASK_VAGUE_INPUT_ERROR;
        suggestions: string[];
        openaiMetadata: Record<string, TOpenaiMetadata>;
      }
  );
