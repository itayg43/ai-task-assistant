import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ERROR_TYPE, TASKS_OPERATION } from "@constants";
import {
  recordPromptInjection,
  recordTasksApiFailure,
  recordTasksApiSuccess,
  recordVagueInput,
} from "@metrics/tasks-metrics";
import {
  mockAiCapabilityResponse,
  mockParsedTask,
  mockUserId,
} from "@mocks/tasks-mocks";
import { createTaskHandler } from "@services/webhooks-service";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@config/env", () => ({
  env: {
    SERVICE_NAME: "tasks",
    SERVICE_PORT: 3000,
  },
}));

vi.mock("@clients/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordTasksApiSuccess: vi.fn(),
  recordTasksApiFailure: vi.fn(),
  recordVagueInput: vi.fn(),
  recordPromptInjection: vi.fn(),
}));

vi.mock("@services/webhooks-service", () => ({
  createTaskHandler: vi.fn(),
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

    it(`should return ${StatusCodes.OK} and record success metrics on successful task creation`, async () => {
      const payload = {
        success: true,
        aiServiceRequestId: mockAiRequestId,
        result: {
          openaiMetadata: mockAiCapabilityResponse.openaiMetadata,
          result: mockParsedTask,
        },
      };

      const response = await request(app).post(createTaskUrl).send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedCreateTaskHandler).toHaveBeenCalledWith(
        mockUserId,
        mockParsedTask,
      );
      expect(recordTasksApiSuccess).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        0,
        mockAiRequestId,
      );
    });

    it(`should record vague input metric when error type is ${AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR}`, async () => {
      const payload = {
        success: false,
        aiServiceRequestId: mockAiRequestId,
        error: {
          status: StatusCodes.BAD_REQUEST,
          message: "Vague input",
          context: {
            type: AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR,
          },
        },
      };

      const response = await request(app).post(createTaskUrl).send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedCreateTaskHandler).not.toHaveBeenCalled();
      expect(recordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockAiRequestId,
      );
      expect(recordVagueInput).toHaveBeenCalledWith(mockAiRequestId);
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

      const response = await request(app).post(createTaskUrl).send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(recordPromptInjection).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockAiRequestId,
      );
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

      const response = await request(app).post(createTaskUrl).send(payload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(recordTasksApiFailure).toHaveBeenCalledWith(
        TASKS_OPERATION.CREATE_TASK,
        mockAiRequestId,
      );
    });
  });
});
