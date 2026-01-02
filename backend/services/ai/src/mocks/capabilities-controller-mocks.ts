import {
  mockParseTaskOutput,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_PATTERN } from "@constants";
import {
  mockOpenaiDurationMs,
  mockOpenaiResponseId,
  mockOpenaiTokenUsage,
} from "@mocks/openai-mocks";

export const mockAsyncPatternCallbackUrl =
  "http://localhost:3001/api/v1/webhooks?windowStartTimestamp=1234567890";

export const mockSyncExecutorResult = {
  openaiMetadata: {
    core: {
      responseId: mockOpenaiResponseId,
      tokens: mockOpenaiTokenUsage,
      durationMs: mockOpenaiDurationMs,
    },
  },
  result: mockParseTaskOutput,
};

export const mockAsyncExecutorResult = {
  message:
    "The parse-task capability has been added to the queue and will start processing shortly.",
};

export const mockSyncPatternInput = {
  ...mockParseTaskValidatedInput,
  query: {
    ...mockParseTaskValidatedInput.query,
    pattern: CAPABILITY_PATTERN.SYNC,
  },
};

export const mockAsyncPatternQueryParams = {
  pattern: CAPABILITY_PATTERN.ASYNC,
  callbackUrl: mockAsyncPatternCallbackUrl,
};

export const mockAsyncPatternInput = {
  ...mockParseTaskValidatedInput,
  query: mockAsyncPatternQueryParams,
};
