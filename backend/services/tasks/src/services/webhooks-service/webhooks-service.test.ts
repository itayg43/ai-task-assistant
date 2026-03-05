import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@clients/prisma";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  mockAiCapabilityResponse,
  mockCreateTaskWebhookOpenaiApiErrorBody,
  mockCreateTaskWebhookSuccessBody,
  mockCreateTaskWebhookVagueInputErrorBody,
  mockTasksServiceRequestId,
  mockTaskWithSubtasks,
} from "@mocks/tasks-mocks";
import { mockRequestMetadata } from "@mocks/token-usage-mocks";
import { createTask, findTaskById } from "@repositories/tasks-repository";
import {
  createTaskFailureCallbackHandler,
  createTaskSuccessCallbackHandler,
} from "@services/webhooks-service";
import { waitForBackgroundTasks } from "@shared/test-utils";

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

vi.mock("@config/env", () => ({
  env: {
    OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS: 10000,
  },
}));

const {
  mockRecordTasksApiSuccess,
  mockRecordTasksApiFailure,
  mockRecordVagueInput,
} = vi.hoisted(() => ({
  mockRecordTasksApiSuccess: vi.fn(),
  mockRecordTasksApiFailure: vi.fn(),
  mockRecordVagueInput: vi.fn(),
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordTasksApiSuccess: mockRecordTasksApiSuccess,
  recordTasksApiFailure: mockRecordTasksApiFailure,
  recordVagueInput: mockRecordVagueInput,
}));

vi.mock("@repositories/subtasks-repository", () => ({
  createManySubtasks: vi.fn(),
}));

vi.mock("@repositories/tasks-repository", () => ({
  createTask: vi.fn(),
  findTaskById: vi.fn(),
}));

const { mockReconcileTokenUsage } = vi.hoisted(() => ({
  mockReconcileTokenUsage: vi.fn(),
}));

vi.mock("@services/token-usage-service", () => ({
  reconcileTokenUsage: mockReconcileTokenUsage,
}));

describe("webhooksService", () => {
  const mockLockTtlMs = 10000;
  const mockRequestIds = {
    aiServiceRequestId: mockAiCapabilityResponse.aiServiceRequestId,
    tasksServiceRequestId: mockTasksServiceRequestId,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTaskSuccessCallbackHandler", () => {
    const { result, openaiMetadata } = mockCreateTaskWebhookSuccessBody.result;

    it("should create task, record success metrics, and reconcile with actual tokens", async () => {
      setupPrismaTransaction();

      await createTaskSuccessCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        result,
        openaiMetadata,
      );

      expect(mockRecordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockRequestMetadata.startTime,
        mockTasksServiceRequestId,
      );

      await waitForBackgroundTasks();

      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockRequestMetadata,
        150, // 100 input + 50 output tokens
        mockLockTtlMs,
      );
    });

    it("should record failure metrics and still reconcile with actual tokens when DB transaction fails", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB Error"));

      await createTaskSuccessCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        result,
        openaiMetadata,
      );

      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      await waitForBackgroundTasks();

      // Reconciles with actual tokens (OpenAI call already happened, regardless of DB failure)
      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockRequestMetadata,
        150, // 100 input + 50 output tokens
        mockLockTtlMs,
      );
    });
  });

  describe("createTaskFailureCallbackHandler", () => {
    it(`should record vague input metric and reconcile with actual tokens for ${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`, async () => {
      const { error } = mockCreateTaskWebhookVagueInputErrorBody;

      createTaskFailureCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        error,
      );

      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );
      expect(mockRecordVagueInput).toHaveBeenCalledWith(
        mockTasksServiceRequestId,
      );

      await waitForBackgroundTasks();

      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockRequestMetadata,
        150, // 100 input + 50 output tokens
        mockLockTtlMs,
      );
    });

    it("should reconcile with 0 tokens for non-vague-input errors", async () => {
      const { error } = mockCreateTaskWebhookOpenaiApiErrorBody;

      createTaskFailureCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        error,
      );

      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );
      expect(mockRecordVagueInput).not.toHaveBeenCalled();

      await waitForBackgroundTasks();

      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockRequestMetadata,
        0,
        mockLockTtlMs,
      );
    });
  });
});

function setupPrismaTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
    const tx = {};
    vi.mocked(createTask).mockResolvedValue({ id: 1 } as any);
    vi.mocked(findTaskById).mockResolvedValue(mockTaskWithSubtasks);
    return fn(tx);
  });
}
