import {
  mockParseTaskOutput,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { CAPABILITY_PATTERN } from "@constants";
import { mockOpenaiResponseId } from "@mocks/openai-mocks";
import { WithDurationResult } from "@shared/types";

export const mockAsyncPatternCallbackUrl =
  "http://localhost:3001/api/v1/webhooks";

export const mockAsyncPatternUserId = 1;

export const mockAsyncPatternTokenReservation = {
  tokensReserved: 1000,
  windowStartTimestamp: Date.now(),
};

export const mockSyncExecutorResult: WithDurationResult<any> = {
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
  durationMs: 100,
};

export const mockAsyncExecutorResult: WithDurationResult<any> = {
  result: {},
  durationMs: 50,
};

export const mockSyncPatternInput = {
  ...mockParseTaskValidatedInput,
  query: {
    ...mockParseTaskValidatedInput.query,
    pattern: CAPABILITY_PATTERN.SYNC,
  },
};

export const mockAsyncPatternInput = {
  ...mockParseTaskValidatedInput,
  query: {
    pattern: CAPABILITY_PATTERN.ASYNC,
    callbackUrl: mockAsyncPatternCallbackUrl,
    userId: mockAsyncPatternUserId,
    tokenReservation: mockAsyncPatternTokenReservation,
  },
};

export const mockAsyncPatternQueryParams = {
  pattern: CAPABILITY_PATTERN.ASYNC,
  callbackUrl: mockAsyncPatternCallbackUrl,
  userId: mockAsyncPatternUserId.toString(),
  tokenReservation: JSON.stringify(mockAsyncPatternTokenReservation),
};
