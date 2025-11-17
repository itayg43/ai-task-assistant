import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

export const mockOpenaiRequestId = "openai-request-id";
export const mockOpenaiResponseId = "openai-response-id";

export const mockPrompt: ResponseCreateParamsNonStreaming = {
  model: "gpt-4.1-mini",
  instructions: "instructions",
  input: "input",
  temperature: 0,
};
