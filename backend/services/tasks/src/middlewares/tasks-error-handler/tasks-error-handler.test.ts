import { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import { tasksErrorHandler } from "@middlewares/tasks-error-handler";
import {
  mockAiCapabilityResponse,
  mockParseTaskVagueInputErrorData,
  mockPromptInjectionErrorData,
  mockRequestId,
  mockTokenUsage,
} from "@mocks/tasks-mocks";
import { BadRequestError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { TAiParseTaskVagueInputErrorData } from "@types";

const { mockRecordVagueInput, mockRecordPromptInjection } = vi.hoisted(() => ({
  mockRecordVagueInput: vi.fn(),
  mockRecordPromptInjection: vi.fn(),
}));

const { mockOpenaiUpdateTokenUsage } = vi.hoisted(() => ({
  mockOpenaiUpdateTokenUsage: vi.fn(),
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordVagueInput: mockRecordVagueInput,
  recordPromptInjection: mockRecordPromptInjection,
}));

vi.mock("@middlewares/token-usage-rate-limiter", () => ({
  openaiUpdateTokenUsage: (...args: unknown[]) =>
    mockOpenaiUpdateTokenUsage(...args),
}));

describe("tasksErrorHandler", () => {
  let mockedRecordVagueInput: Mocked<typeof mockRecordVagueInput>;
  let mockedRecordPromptInjection: Mocked<typeof mockRecordPromptInjection>;
  let mockedOpenaiUpdateTokenUsage: Mocked<typeof mockOpenaiUpdateTokenUsage>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  const executeMiddleware = (error: unknown) => {
    tasksErrorHandler(error, req as Request, res as Response, next);
  };

  beforeEach(() => {
    mockedRecordVagueInput = vi.mocked(mockRecordVagueInput);
    mockedRecordPromptInjection = vi.mocked(mockRecordPromptInjection);
    mockedOpenaiUpdateTokenUsage = vi.mocked(mockOpenaiUpdateTokenUsage);

    req = {};

    res = {
      locals: {
        requestId: mockRequestId,
        tokenUsage: mockTokenUsage,
      },
    };

    next = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe(`${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`, () => {
    it("should record vague input metric and reconcile token usage when both tokenUsage and openaiMetadata exist", () => {
      const vagueInputErrorData: TAiParseTaskVagueInputErrorData = {
        ...mockParseTaskVagueInputErrorData,
        openaiMetadata: {
          core: {
            responseId: "id-1",
            tokens: { input: 100, output: 50 },
            durationMs: 500,
          },
        },
      };
      const vagueInputError = new BadRequestError(
        vagueInputErrorData.message,
        vagueInputErrorData
      );

      executeMiddleware(vagueInputError);

      expect(mockedRecordVagueInput).toHaveBeenCalledWith(mockRequestId);
      expect(mockedRecordVagueInput).toHaveBeenCalledTimes(1);
      expect(res.locals?.tokenUsage?.actualTokens).toBe(150);
      expect(mockedOpenaiUpdateTokenUsage).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        description: "tokenUsage is missing",
        setup: () => {
          res.locals = {
            requestId: mockRequestId,
          };
        },
        errorData: (): TAiParseTaskVagueInputErrorData => ({
          ...mockParseTaskVagueInputErrorData,
          openaiMetadata: {
            core: {
              responseId: "id-1",
              tokens: {
                input: 10,
                output: 5,
              },
              durationMs: 500,
            },
          },
        }),
      },
      {
        description: "openaiMetadata is missing",
        setup: () => {},
        errorData: (): Record<string, unknown> => {
          const { openaiMetadata, ...dataWithoutMetadata } =
            mockParseTaskVagueInputErrorData;
          return dataWithoutMetadata;
        },
      },
      {
        description: "openaiMetadata is empty object",
        setup: () => {},
        errorData: (): TAiParseTaskVagueInputErrorData => ({
          ...mockParseTaskVagueInputErrorData,
          openaiMetadata: {},
        }),
      },
    ])(
      "should NOT reconcile token usage when $description",
      ({ setup, errorData }) => {
        setup();

        const vagueInputErrorData = errorData();
        const vagueInputError = new BadRequestError(
          vagueInputErrorData.message as string,
          vagueInputErrorData
        );

        executeMiddleware(vagueInputError);

        expect(mockedOpenaiUpdateTokenUsage).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      }
    );

    it("should sanitize error: create new BadRequestError with only message and suggestions in context", () => {
      const vagueInputErrorData: TAiParseTaskVagueInputErrorData = {
        ...mockParseTaskVagueInputErrorData,
        openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
      };
      const vagueInputError = new BadRequestError(
        vagueInputErrorData.message,
        vagueInputErrorData
      );

      executeMiddleware(vagueInputError);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      const sanitizedError = next.mock.calls[0][0] as BadRequestError;
      expect(sanitizedError).not.toBe(vagueInputError);
      expect(sanitizedError.message).toBe(vagueInputErrorData.message);
      expect(sanitizedError.context).toMatchObject({
        suggestions: vagueInputErrorData.suggestions,
      });
    });
  });

  describe(`${AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED}`, () => {
    it("should record prompt injection metric with CREATE_TASK operation and correct requestId", () => {
      const promptInjectionError = new BadRequestError(
        mockPromptInjectionErrorData.message,
        mockPromptInjectionErrorData
      );

      executeMiddleware(promptInjectionError);

      expect(mockedRecordPromptInjection).toHaveBeenCalledTimes(1);
      expect(mockedRecordPromptInjection).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockRequestId
      );
    });

    it("should sanitize error: create new BadRequestError with only message (no context)", () => {
      const promptInjectionErrorData = {
        ...mockPromptInjectionErrorData,
        aiServiceId: "ai-service-123",
        additionalField: "should be stripped",
      };
      const promptInjectionError = new BadRequestError(
        promptInjectionErrorData.message,
        promptInjectionErrorData
      );

      executeMiddleware(promptInjectionError);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      const sanitizedError = next.mock.calls[0][0] as BadRequestError;
      expect(sanitizedError).not.toBe(promptInjectionError);
      expect(sanitizedError.message).toBe(mockPromptInjectionErrorData.message);
      expect(sanitizedError.context).toBeUndefined();
    });
  });

  describe("Error passthrough", () => {
    it("should pass through non-BaseError errors", () => {
      const genericError = new Error("Generic error");

      executeMiddleware(genericError);
      expect(next).toHaveBeenCalledWith(genericError);
      expect(mockedRecordVagueInput).not.toHaveBeenCalled();
    });

    it("should pass through BaseError without context.type", () => {
      const baseError = new BadRequestError("Some error", {
        someField: "value",
      });

      executeMiddleware(baseError);

      expect(next).toHaveBeenCalledWith(baseError);
    });

    it("should pass through BaseError with context.type that's not handled", () => {
      const baseError = new BadRequestError("Some error", {
        type: "UNKNOWN_ERROR_TYPE",
      });

      executeMiddleware(baseError);

      expect(next).toHaveBeenCalledWith(baseError);
    });
  });
});
