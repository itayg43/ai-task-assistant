import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockCreateTaskWebhookOpenaiApiErrorBody,
  mockCreateTaskWebhookSuccessBody,
  mockTasksServiceRequestId,
  mockUserId,
} from "@mocks/tasks-mocks";
import { mockRequestMetadata } from "@mocks/token-usage-mocks";
import {
  createTaskFailureCallbackHandler,
  createTaskSuccessCallbackHandler,
} from "@services/webhooks-service";
import type { Mocked } from "@shared/types";
import type { CreateTaskWebhookInput } from "@types";
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

vi.mock("@clients/redis", () => ({
  redis: {},
}));

vi.mock("@clients/redlock", () => ({
  redlock: {},
}));

const { mockRecordMetadataNotFound } = vi.hoisted(() => ({
  mockRecordMetadataNotFound: vi.fn(),
}));

vi.mock("@metrics/tasks-metrics", () => ({
  recordMetadataNotFound: mockRecordMetadataNotFound,
}));

const {
  mockCreateTaskCallbackSuccessHandler,
  mockCreateTaskCallbackFailureHandler,
} = vi.hoisted(() => ({
  mockCreateTaskCallbackSuccessHandler: vi.fn(),
  mockCreateTaskCallbackFailureHandler: vi.fn(),
}));

vi.mock("@services/webhooks-service", () => ({
  createTaskSuccessCallbackHandler: mockCreateTaskCallbackSuccessHandler,
  createTaskFailureCallbackHandler: mockCreateTaskCallbackFailureHandler,
}));

const { mockGetRequestMetadata } = vi.hoisted(() => ({
  mockGetRequestMetadata: vi.fn(),
}));

vi.mock("@services/token-usage-service", () => ({
  getRequestMetadata: mockGetRequestMetadata,
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
  let mockedSuccessHandler: Mocked<typeof createTaskSuccessCallbackHandler>;
  let mockedFailureHandler: Mocked<typeof createTaskFailureCallbackHandler>;

  beforeEach(() => {
    mockedSuccessHandler = vi.mocked(createTaskSuccessCallbackHandler);
    mockedFailureHandler = vi.mocked(createTaskFailureCallbackHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    const createTaskUrl = "/api/v1/webhooks/create-task";

    it(`should return ${StatusCodes.OK} and call success handler on successful callback`, async () => {
      mockGetRequestMetadata.mockResolvedValue(mockRequestMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedSuccessHandler).toHaveBeenCalledWith(
        {
          aiServiceRequestId: testPayload.aiServiceRequestId,
          tasksServiceRequestId: mockTasksServiceRequestId,
        },
        mockRequestMetadata,
        testPayload.result,
      );
      expect(mockedFailureHandler).not.toHaveBeenCalled();
    });

    it(`should return ${StatusCodes.OK} and call failure handler on failed callback`, async () => {
      mockGetRequestMetadata.mockResolvedValue(mockRequestMetadata);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookOpenaiApiErrorBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockedFailureHandler).toHaveBeenCalledWith(
        {
          aiServiceRequestId: testPayload.aiServiceRequestId,
          tasksServiceRequestId: mockTasksServiceRequestId,
        },
        mockRequestMetadata,
        testPayload.error,
      );
      expect(mockedSuccessHandler).not.toHaveBeenCalled();
    });

    it("should record metadata not found metric and skip handlers when metadata expired", async () => {
      mockGetRequestMetadata.mockResolvedValue(null);

      const testPayload: CreateTaskWebhookInput["body"] =
        mockCreateTaskWebhookSuccessBody;

      const response = await request(app)
        .post(createTaskUrl)
        .query({ tasksServiceRequestId: mockTasksServiceRequestId })
        .send(testPayload);

      expect(response.status).toBe(StatusCodes.OK);
      expect(mockRecordMetadataNotFound).toHaveBeenCalledWith(
        mockTasksServiceRequestId,
      );
      expect(mockedSuccessHandler).not.toHaveBeenCalled();
      expect(mockedFailureHandler).not.toHaveBeenCalled();
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
