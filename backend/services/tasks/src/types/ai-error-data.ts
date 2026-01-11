import { AI_ERROR_TYPE } from "@constants";
import { TOpenaiMetadata } from "@types";

type TBaseAiErrorData = {
  message: string;
};

export type TAiParseTaskVagueInputErrorData = TBaseAiErrorData & {
  type: typeof AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR;
  suggestions: string[];
  openaiMetadata: Record<string, TOpenaiMetadata>;
};

export type TAiPromptInjectionDetectedErrorData = TBaseAiErrorData & {
  type: typeof AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED;
};

export type TAiRabbitMQSendMessageToQueueFailed = TBaseAiErrorData & {
  type: typeof AI_ERROR_TYPE.RABBITMQ_SEND_MESSAGE_TO_QUEUE_FAILED;
};

export type TAiErrorData =
  | TAiParseTaskVagueInputErrorData
  | TAiPromptInjectionDetectedErrorData
  | TAiRabbitMQSendMessageToQueueFailed;
