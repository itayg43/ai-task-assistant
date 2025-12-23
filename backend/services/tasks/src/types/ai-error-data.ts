import {
  PARSE_TASK_VAGUE_INPUT_ERROR,
  PROMPT_INJECTION_DETECTED,
} from "@constants";
import { TOpenaiMetadata } from "@types";

type TBaseAiErrorData = {
  message: string;
};

export type TAiParseTaskVagueInputErrorData = TBaseAiErrorData & {
  type: typeof PARSE_TASK_VAGUE_INPUT_ERROR;
  suggestions: string[];
  openaiMetadata: Record<string, TOpenaiMetadata>;
};

export type TAiPromptInjectionDetectedErrorData = TBaseAiErrorData & {
  type: typeof PROMPT_INJECTION_DETECTED;
};

export type TAiErrorData =
  | TAiParseTaskVagueInputErrorData
  | TAiPromptInjectionDetectedErrorData;
