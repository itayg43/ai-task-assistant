import {
  mockParseTaskOutput,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_PATTERN } from "@constants";
import { mockOpenaiResponseId } from "@mocks/openai-mocks";

export const mockAsyncPatternCallbackUrl =
  "http://localhost:3001/api/v1/webhooks?windowStartTimestamp=1234567890";

export const mockSyncExecutorResult = {
  result: {
    openaiMetadata: {
      responseId: mockOpenaiResponseId,
      tokens: {
        input: 10,
        output: 20,
      },
      durationMs: 42,
    },
    result: mockParseTaskOutput,
  },
};

export const mockAsyncExecutorResult = {
  result: {},
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
