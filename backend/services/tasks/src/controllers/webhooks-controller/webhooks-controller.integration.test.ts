import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  mockAiCapabilityResponse,
  mockParsedTask,
  mockParseTaskVagueInputErrorData,
  mockTasksServiceRequestId,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createTaskHandler } from "@services/webhooks-service";
import { waitForBackgroundTasks } from "@shared/test-utils";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@config/env", () => ({
  env: {
    SERVICE_NAME: "tasks",
    SERVICE_PORT: 3000,
    OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS: 10000,
  },
}));

vi.mock("@clients/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@clients/redis", () => ({
  redis: {},
}));

vi.mock("@clients/redlock", () => ({
  redlock: {},
}));

const {
  mockRecordTasksApiSuccess,
  mockRecordTasksApiFailure,
  mockRecordVagueInput,
  mockRecordPromptInjection,
} = vi.hoisted(() => ({
  mockRecordTasksApiSuccess: vi.fn(),
  mockRecordTasksApiFailure: vi.fn(),
  mockRecordVagueInput: vi.fn(),
  mockRecordPromptInjection: vi.fn(),
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordTasksApiSuccess: mockRecordTasksApiSuccess,
  recordTasksApiFailure: mockRecordTasksApiFailure,
  recordVagueInput: mockRecordVagueInput,
  recordPromptInjection: mockRecordPromptInjection,
}));

vi.mock("@services/webhooks-service", () => ({
  createTaskHandler: vi.fn(),
}));

const { mockGetRequestMetadata } = vi.hoisted(() => ({
  mockGetRequestMetadata: vi.fn(),
}));

vi.mock("@services/token-usage-service", () => ({
  getRequestMetadata: mockGetRequestMetadata,
}));

const { mockReconcileTokensIfPossible } = vi.hoisted(() => ({
  mockReconcileTokensIfPossible: vi.fn(),
}));

vi.mock("@utils/reconcile-tokens-if-possible", () => ({
  reconcileTokensIfPossible: mockReconcileTokensIfPossible,
}));

vi.mock("@shared/middlewares/authentication", () => ({
  authentication: (_req: any, res: any, next: any) => {
    res.locals.authenticationContext = {
      userId: mockUserId,
    };
    next();
  },
}));

// Mock CORS middleware using __mocks__ directory with explicit import path
vi.mock("@middlewares/cors", () => {
  return import("../../middlewares/cors/__mocks__/cors");
});

describe("webhooksController (integration)", () => {
  let mockedCreateTaskHandler: Mocked<typeof createTaskHandler>;

  const mockAiRequestId = mockAiCapabilityResponse.aiServiceRequestId;

  beforeEach(() => {
    mockedCreateTaskHandler = vi.mocked(createTaskHandler);
    mockedCreateTaskHandler.mockResolvedValue({ id: 1 } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    const createTaskUrl = "/api/v1/webhooks/create-task";

    it(`should return ${StatusCodes.OK} and record success metrics with calculated duration on successful task creation`, async () => {
      const startTime = Date.now() - 1000; // 1 second ago
      mockGetRequestMetadata.mockResolvedValue({
        userId: mockUserId,
        tokensReserved: 200,
        windowStartTimestamp: Date.now(),
        startTime,
        serviceName: "tasks",
        rateLimiterName: "openai-token-usage",
      });

      const payload = {
        success: true,
        aiServiceRequestId: mockAiRequestId,
        result: {
          openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
          result: mockParsedTask,
        },
      };

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedCreateTaskHandler).toHaveBeenCalledWith(
        mockUserId,
        mockParsedTask,
      );

      // Wait for background reconciliation and metrics to complete
      await waitForBackgroundTasks();

      expect(mockReconcileTokensIfPossible).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockTasksServiceRequestId,
        expect.any(Number),
        expect.any(Number),
      );
      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        startTime,
        mockTasksServiceRequestId,
      );
      // Verify startTime is passed and calculate duration
      const recordedStartTime = (mockRecordTasksApiSuccess as any).mock.calls[0][1];
      const calculatedDuration = Date.now() - recordedStartTime;
      expect(calculatedDuration).toBeGreaterThan(900);
      expect(calculatedDuration).toBeLessThan(1100);
    });

    it(`should record vague input metric and reconcile token usage when error type is ${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`, async () => {
      const payload = {
        success: false,
        aiServiceRequestId: mockAiRequestId,
        error: {
          status: StatusCodes.BAD_REQUEST,
          message: "Vague input",
          context: mockParseTaskVagueInputErrorData,
        },
      };

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedCreateTaskHandler).not.toHaveBeenCalled();
      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );
      expect(mockRecordVagueInput).toHaveBeenCalledWith(
        mockTasksServiceRequestId,
      );

      // Wait for background reconciliation to complete
      await waitForBackgroundTasks();

      // Verify token reconciliation was called with expected token count
      expect(mockReconcileTokensIfPossible).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        mockTasksServiceRequestId,
        150, // mockAiCapabilityResponse has 100 input + 50 output tokens
        expect.any(Number), // lock TTL
      );

      // Verify success metrics NOT called (this is an error case)
      expect(mockRecordTasksApiSuccess).not.toHaveBeenCalled();
    });

    it("should reconcile with 0 tokens for errors without openaiMetadata (non-vague-input errors)", async () => {
      const payload = {
        success: false,
        aiServiceRequestId: mockAiRequestId,
        error: {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          message: "Some error without token data",
          context: {
            type: AI_ERROR_TYPE.OPENAI_API_ERROR,
            openaiRequestId: "req_123",
          },
        },
      };

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      // Wait for background reconciliation to complete
      await waitForBackgroundTasks();

      // Verify token reconciliation with 0 tokens (no OpenAI metadata available)
      expect(mockReconcileTokensIfPossible).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockTasksServiceRequestId,
        0, // No tokens consumed
        expect.any(Number),
      );
    });

    it("should use duration 0 when metadata not found (expired)", async () => {
      mockGetRequestMetadata.mockResolvedValue(null); // Metadata expired

      const payload = {
        success: true,
        aiServiceRequestId: mockAiRequestId,
        result: {
          openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
          result: mockParsedTask,
        },
      };

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);

      // Wait for background reconciliation and metrics to complete
      await waitForBackgroundTasks();

      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        expect.any(Number), // Falls back to Date.now()
        mockTasksServiceRequestId,
      );
      // When metadata is null, fallback to Date.now() results in near-0 duration
      const recordedStartTime = (mockRecordTasksApiSuccess as any).mock.calls[0][1];
      const calculatedDuration = Date.now() - recordedStartTime;
      expect(calculatedDuration).toBeLessThan(50);
    });

    it(`should return ${StatusCodes.OK} and record failure metrics when createTaskHandler fails`, async () => {
      const payload = {
        success: true,
        aiServiceRequestId: mockAiRequestId,
        result: {
          openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
          result: mockParsedTask,
        },
      };

      mockedCreateTaskHandler.mockRejectedValue(new Error("DB Error"));

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      // Wait for background reconciliation to complete
      await waitForBackgroundTasks();

      // Verify token reconciliation with 0 tokens (internal error, no OpenAI call)
      expect(mockReconcileTokensIfPossible).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockTasksServiceRequestId,
        0,
        expect.any(Number),
      );
    });

    it(`should return ${StatusCodes.BAD_REQUEST} when tasksServiceRequestId query parameter is missing`, async () => {
      const payload = {
        success: true,
        aiServiceRequestId: mockAiRequestId,
        result: {
          openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
          result: mockParsedTask,
        },
      };

      const response = await request(app).post(createTaskUrl).send(payload);

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });
  });
});
