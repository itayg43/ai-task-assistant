import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@clients/prisma";
import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  mockAiCapabilityResponse,
  mockCreateTaskWebhookOpenaiApiErrorBody,
  mockCreateTaskWebhookSuccessBody,
  mockCreateTaskWebhookVagueInputErrorBody,
  mockOpenaiTotalTokens,
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

const { MOCK_LOCK_TTL_MS } = vi.hoisted(() => ({
  MOCK_LOCK_TTL_MS: 10000,
}));

vi.mock("@config/env", () => ({
  env: {
    OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS: MOCK_LOCK_TTL_MS,
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

vi.mock("@shared/utils/with-retry", () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

describe("webhooksService", () => {
  const mockRequestIds = {
    aiServiceRequestId: mockAiCapabilityResponse.aiServiceRequestId,
    tasksServiceRequestId: mockTasksServiceRequestId,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTaskSuccessCallbackHandler", () => {
    it("should create task, record success metrics, and reconcile with actual tokens", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {};
        vi.mocked(createTask).mockResolvedValue({ id: 1 } as any);
        vi.mocked(findTaskById).mockResolvedValue(mockTaskWithSubtasks);
        return fn(tx);
      });

      await createTaskSuccessCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        mockCreateTaskWebhookSuccessBody.result,
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
        mockOpenaiTotalTokens,
        MOCK_LOCK_TTL_MS,
      );
    });

    it("should record failure metrics and reconcile with actual tokens when all DB retries fail", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB Error"));

      await createTaskSuccessCallbackHandler(
        mockRequestIds,
        mockRequestMetadata,
        mockCreateTaskWebhookSuccessBody.result,
      );

      expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockTasksServiceRequestId,
      );

      await waitForBackgroundTasks();

      expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockRequestMetadata,
        mockOpenaiTotalTokens,
        MOCK_LOCK_TTL_MS,
      );
    });
  });

  describe("createTaskFailureCallbackHandler", () => {
    it.each([
      {
        name: `${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`,
        error: mockCreateTaskWebhookVagueInputErrorBody.error,
        expectedTokens: mockOpenaiTotalTokens,
        expectsVagueInput: true,
      },
      {
        name: "non-vague-input error",
        error: mockCreateTaskWebhookOpenaiApiErrorBody.error,
        expectedTokens: 0,
        expectsVagueInput: false,
      },
    ])(
      "should record failure metric and reconcile tokens for $name",
      async ({ error, expectedTokens, expectsVagueInput }) => {
        createTaskFailureCallbackHandler(
          mockRequestIds,
          mockRequestMetadata,
          error,
        );

        expect(mockRecordTasksApiFailure).toHaveBeenCalledWith(
          TASKS_OPERATION.CREATE_TASK,
          mockTasksServiceRequestId,
        );

        if (expectsVagueInput) {
          expect(mockRecordVagueInput).toHaveBeenCalledWith(
            mockTasksServiceRequestId,
          );
        } else {
          expect(mockRecordVagueInput).not.toHaveBeenCalled();
        }

        await waitForBackgroundTasks();

        expect(mockReconcileTokenUsage).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          mockRequestMetadata,
          expectedTokens,
          MOCK_LOCK_TTL_MS,
        );
      },
    );
  });
});
