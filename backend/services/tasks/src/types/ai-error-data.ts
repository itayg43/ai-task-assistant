import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
import { TOpenaiMetadata } from "@types";

type TBaseAiErrorData = {
  message: string;
};

export type TAiParseTaskVagueInputErrorData = TBaseAiErrorData & {
  type: typeof PARSE_TASK_VAGUE_INPUT_ERROR;
  suggestions: string[];
  openaiMetadata: Record<string, TOpenaiMetadata>;
};

export type TAiErrorData = TAiParseTaskVagueInputErrorData;
