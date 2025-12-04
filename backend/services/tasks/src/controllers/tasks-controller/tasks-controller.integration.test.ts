import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAiCapabilityResponse,
  mockNaturalLanguage,
  mockParsedTask,
  mockTask,
  mockTaskWithSubtasks,
} from "@mocks/tasks-mocks";
import { executeCapability } from "@services/ai-capabilities-service";
import { DEFAULT_ERROR_MESSAGE } from "@shared/constants";
import {
  BadRequestError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "@shared/errors";
import { Mocked } from "@shared/types";
import { app } from "../../app";

vi.mock("@config/env", () => ({
  env: {
    SERVICE_NAME: "tasks",
    SERVICE_PORT: 3000,
  },
}));

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
}));

vi.mock("@repositories/tasks-repository", () => ({
  createTask: vi.fn(),
  findTaskById: vi.fn(),
}));

vi.mock("@repositories/subtasks-repository", () => ({
  createManySubtasks: vi.fn(),
}));

vi.mock("@clients/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const { mockTokenBucketRateLimiter } = vi.hoisted(() => ({
  mockTokenBucketRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock("@middlewares/token-bucket-rate-limiter", () => ({
  tokenBucketRateLimiter: {
    global: mockTokenBucketRateLimiter,
  },
}));

vi.mock("@shared/middlewares/authentication", () => ({
  authentication: (_req: any, res: any, next: any) => {
    res.locals.authenticationContext = {
      userId: 1,
    };
    next();
  },
}));

describe("tasksController (integration)", () => {
  let mockedExecuteCapability: Mocked<typeof executeCapability>;

  let mockTransaction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockedExecuteCapability = vi.mocked(executeCapability);

    mockTokenBucketRateLimiter.mockImplementation((_req, _res, next) => next());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTaskHandler", () => {
    const createTaskUrl = "/api/v1/tasks/create";

    beforeEach(async () => {
      const {
        createTask: createTaskRepository,
        findTaskById: findTaskByIdRepository,
      } = await import("@repositories/tasks-repository");
      vi.mocked(createTaskRepository).mockResolvedValue(mockTask);
      vi.mocked(findTaskByIdRepository).mockResolvedValue(mockTaskWithSubtasks);

      mockTransaction = vi.fn(async (callback) => {
        return await callback({});
      });

      const { prisma } = await import("@clients/prisma");
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
    });

    it("should return 201 with task including subtasks for valid input", async () => {
      mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
      expect(response.body).toMatchObject({
        tasksServiceRequestId: expect.any(String),
        id: 1,
        userId: 1,
        naturalLanguage: mockNaturalLanguage,
        title: mockParsedTask.title,
        category: mockParsedTask.category,
        priorityLevel: mockParsedTask.priority.level,
        priorityScore: mockParsedTask.priority.score,
        priorityReason: mockParsedTask.priority.reason,
        subtasks: [],
      });
      expect(response.body.subtasks).toBeDefined();
      expect(Array.isArray(response.body.subtasks)).toBe(true);
    });

    it("should return 400 for invalid input (empty naturalLanguage)", async () => {
      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: "",
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    });

    it("should handle AI service BadRequestError and return 400", async () => {
      const badRequestError = new BadRequestError("Input is too vague", {
        suggestions: ["Add more details"],
      });
      mockedExecuteCapability.mockRejectedValue(badRequestError);

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("Input is too vague");
      expect(response.body.suggestions).toEqual(["Add more details"]);
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    });

    it("should handle unexpected errors and return 500", async () => {
      mockedExecuteCapability.mockRejectedValue(new Error("Unexpected error"));

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body.message).toBeDefined();
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    });

    it("should return 429 when rate limit is exceeded", async () => {
      mockTokenBucketRateLimiter.mockImplementation((_req, _res, next) => {
        next(new TooManyRequestsError());
      });

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(response.body.message).toBe(
        "Rate limit exceeded, please try again later."
      );
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    });

    it("should return 503 when token bucket rate limiter service error occurs", async () => {
      const rateLimiterError = new ServiceUnavailableError();
      mockTokenBucketRateLimiter.mockImplementation((_req, _res, next) => {
        next(rateLimiterError);
      });

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
      expect(response.body.message).toBe(DEFAULT_ERROR_MESSAGE);
      expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    });
  });
});
