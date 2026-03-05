import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  mockCreateTaskWebhookOpenaiApiErrorBody,
  mockCreateTaskWebhookSuccessBody,
  mockCreateTaskWebhookVagueInputErrorBody,
  mockParsedTask,
  mockTasksServiceRequestId,
  mockUserId,
} from "@mocks/tasks-mocks";
import { mockRequestMetadata } from "@mocks/token-usage-mocks";
import { createTaskHandler } from "@services/webhooks-service";
import { waitForBackgroundTasks } from "@shared/test-utils";
import type { Mocked, RequestMetadata } from "@shared/types";
import type { CreateTaskWebhookInput } from "@types";
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
  mockRecordMetadataNotFound,
} = vi.hoisted(() => ({
  mockRecordTasksApiSuccess: vi.fn(),
  mockRecordTasksApiFailure: vi.fn(),
  mockRecordVagueInput: vi.fn(),
  mockRecordPromptInjection: vi.fn(),
  mockRecordMetadataNotFound: vi.fn(),
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordTasksApiSuccess: mockRecordTasksApiSuccess,
  recordTasksApiFailure: mockRecordTasksApiFailure,
  recordVagueInput: mockRecordVagueInput,
  recordPromptInjection: mockRecordPromptInjection,
  recordMetadataNotFound: mockRecordMetadataNotFound,
}));

vi.mock("@services/webhooks-service", () => ({
  createTaskHandler: vi.fn(),
}));

const { mockGetRequestMetadata, mockReconcileTokenUsage } = vi.hoisted(() => ({
  mockGetRequestMetadata: vi.fn(),
  mockReconcileTokenUsage: vi.fn(),
}));

vi.mock("@services/token-usage-service", () => ({
  getRequestMetadata: mockGetRequestMetadata,
  reconcileTokenUsage: mockReconcileTokenUsage,
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

  const mockLockTtlMs = 10000; // Matches env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS

  beforeEach(() => {
    mockedCreateTaskHandler = vi.mocked(createTaskHandler);
    mockedCreateTaskHandler.mockResolvedValue({ id: 1 } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    const createTaskUrl = "/api/v1/webhooks/create-task";

    it(`should return ${StatusCodes.OK} and record success metrics on successful task creation`, async () => {
      const startTime = Date.now() - 1000; // 1 second ago
      const testMetadata: RequestMetadata = {
        ...mockRequestMetadata,
        startTime,
      };
      mockGetRequestMetadata.mockResolvedValue(testMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedCreateTaskHandler).toHaveBeenCalledWith(
        mockUserId,
        mockParsedTask,
      );

      // Wait for background reconciliation and metrics to complete
      await waitForBackgroundTasks();

      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        testMetadata,
        expect.any(Number), // actualTokens
        mockLockTtlMs,
      );
      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        startTime,
        mockTasksServiceRequestId,
      );
    });

    it(`should record vague input metric and reconcile token usage when error type is ${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`, async () => {
      mockGetRequestMetadata.mockResolvedValue(mockRequestMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookVagueInputErrorBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

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

      // Verify token reconciliation was called with metadata and expected token count
      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        mockRequestMetadata,
        150, // mockAiCapabilityResponse has 100 input + 50 output tokens
        mockLockTtlMs,
      );

      // Verify success metrics NOT called (this is an error case)
      expect(mockRecordTasksApiSuccess).not.toHaveBeenCalled();
    });

    it("should reconcile with 0 tokens for errors without openaiMetadata (non-vague-input errors)", async () => {
      mockGetRequestMetadata.mockResolvedValue(mockRequestMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookOpenaiApiErrorBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      // Wait for background reconciliation to complete
      await waitForBackgroundTasks();

      // Verify token reconciliation with 0 tokens (no OpenAI metadata available)
      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        mockRequestMetadata,
        0, // No tokens consumed
        mockLockTtlMs,
      );
    });

    it("should record metadata not found metric and skip reconciliation when metadata expired", async () => {
      mockGetRequestMetadata.mockResolvedValue(null); // Metadata expired

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);

      // Verify metadata not found metric was recorded
      expect(mockRecordMetadataNotFound).toHaveBeenCalledWith(
        mockTasksServiceRequestId,
      );

      // Wait for background tasks to complete
      await waitForBackgroundTasks();

      // Verify success metrics use fallback timestamp
      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        expect.any(Number), // Falls back to Date.now()
        mockTasksServiceRequestId,
      );

      // Verify reconciliation was NOT called (no metadata available)
      expect(mockReconcileTokenUsage).not.toHaveBeenCalled();
    });

    it(`should return ${StatusCodes.OK} and record failure metrics when createTaskHandler fails (internal error, not AI parsing error)`, async () => {
      mockGetRequestMetadata.mockResolvedValue(mockRequestMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      mockedCreateTaskHandler.mockRejectedValue(new Error("DB Error"));

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      // Wait for background reconciliation to complete
      await waitForBackgroundTasks();

      // Verify token reconciliation with 0 tokens (internal error - database/webhook processing failure, not AI parsing error)
      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object), // redis
        expect.any(Object), // redlock
        mockRequestMetadata,
        0, // No OpenAI call involved
        mockLockTtlMs,
      );
    });

    it(`should return ${StatusCodes.BAD_REQUEST} when tasksServiceRequestId query parameter is missing`, async () => {
      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      const response = await request(app).post(createTaskUrl).send(testPayload);

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });
  });
});
