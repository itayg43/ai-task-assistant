import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

export const mockOpenaiRequestId = "openai-request-id";
export const mockOpenaiResponseId = "openai-response-id";

export const mockOpenaiTokenUsage = {
  input: 150,
  output: 135,
};

export const mockOpenaiDurationMs = 250;

export const mockPromptVersion = "v1";

export const mockPrompt: ResponseCreateParamsNonStreaming = {
  model: "gpt-4.1-mini",
  instructions: "instructions",
  input: "input",
  temperature: 0,
};

export class MockAPIError extends Error {
  requestID?: string;
  error?: { message?: string };
  status?: number;

  constructor(message: string, status?: number, requestId?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.requestID = requestId;
    this.error = { message };
  }
}
