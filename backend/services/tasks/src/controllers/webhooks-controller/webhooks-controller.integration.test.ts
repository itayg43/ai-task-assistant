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

const { mockReconcileTokenUsageFromCallback } = vi.hoisted(() => ({
  mockReconcileTokenUsageFromCallback: vi.fn(),
}));

vi.mock("@services/token-usage-service", () => ({
  reconcileTokenUsageFromCallback: mockReconcileTokenUsageFromCallback,
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
      mockReconcileTokenUsageFromCallback.mockResolvedValue(startTime);

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

      expect(mockReconcileTokenUsageFromCallback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockTasksServiceRequestId,
        expect.any(Number),
        expect.any(Number),
      );
      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        expect.any(Number),
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
      expect(mockReconcileTokenUsageFromCallback).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        mockTasksServiceRequestId,
        150, // mockAiCapabilityResponse has 100 input + 50 output tokens
        expect.any(Number), // lock TTL
      );

      // Verify success metrics NOT called (this is an error case)
      expect(mockRecordTasksApiSuccess).not.toHaveBeenCalled();
    });

    it(`should record prompt injection metric when error type is ${AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED}`, async () => {
      const payload = {
        success: false,
        aiServiceRequestId: mockAiRequestId,
        error: {
          status: StatusCodes.BAD_REQUEST,
          message: "Injection detected",
          context: {
            type: AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED,
          },
        },
      };

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordPromptInjection).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );
    });

    it(`should use duration 0 when reconciliation returns null (metadata expired)`, async () => {
      mockReconcileTokenUsageFromCallback.mockResolvedValue(null);

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

      expect(mockReconcileTokenUsageFromCallback).toHaveBeenCalled();
      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        expect.any(Number),
        mockTasksServiceRequestId,
      );
      // When startTime is null, fallback to Date.now() results in near-0 duration
      const recordedStartTime = (mockRecordTasksApiSuccess as any).mock.calls[0][1];
      const calculatedDuration = Date.now() - recordedStartTime;
      expect(calculatedDuration).toBeLessThan(50);
    });

    it(`should return ${StatusCodes.OK} and record failure metrics when createTaskHandler fails`, async () => {
      mockReconcileTokenUsageFromCallback.mockResolvedValue(null);

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
