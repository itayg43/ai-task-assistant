import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET_TASKS_ALLOWED_ORDER_BY_FIELDS,
  GET_TASKS_ALLOWED_ORDER_DIRECTIONS,
  GET_TASKS_DEFAULT_SKIP,
  GET_TASKS_DEFAULT_TAKE,
  PARSE_TASK_VAGUE_INPUT_ERROR,
} from "@constants";
import {
  mockAiCapabilityResponse,
  mockFindTasksResult,
  mockGetTasksInputQuery,
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
import { GetTasksResponse } from "@types";
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
  findTasks: vi.fn(),
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

const { mockOpenaiTokenUsageRateLimiter, mockOpenaiUpdateTokenUsage } =
  vi.hoisted(() => ({
    mockOpenaiTokenUsageRateLimiter: vi.fn((_req, _res, next) => next()),
    mockOpenaiUpdateTokenUsage: vi.fn((_req, _res, next) => next()),
  }));

vi.mock("@middlewares/token-bucket-rate-limiter", () => ({
  tokenBucketRateLimiter: {
    global: mockTokenBucketRateLimiter,
  },
}));

vi.mock("@middlewares/token-usage-rate-limiter", () => ({
  openaiTokenUsageRateLimiter: {
    createTask: mockOpenaiTokenUsageRateLimiter,
  },
  openaiUpdateTokenUsage: mockOpenaiUpdateTokenUsage,
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
    mockOpenaiTokenUsageRateLimiter.mockImplementation((_req, _res, next) =>
      next()
    );
    mockOpenaiUpdateTokenUsage.mockImplementation((_req, _res, next) => next());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    const createTaskUrl = "/api/v1/tasks";

    beforeEach(async () => {
      const { createTask, findTaskById } = await import(
        "@repositories/tasks-repository"
      );
      vi.mocked(createTask).mockResolvedValue(mockTask);
      vi.mocked(findTaskById).mockResolvedValue(mockTaskWithSubtasks);

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
      expect(response.body).toMatchObject({
        tasksServiceRequestId: expect.any(String),
        task: {
          id: 1,
          title: mockParsedTask.title,
          category: mockParsedTask.category,
          priority: {
            level: mockParsedTask.priority.level,
            score: mockParsedTask.priority.score,
            reason: mockParsedTask.priority.reason,
          },
          subtasks: [],
        },
      });
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

    it("should reconcile token usage on vague input error and return 400", async () => {
      mockOpenaiTokenUsageRateLimiter.mockImplementation((_req, res, next) => {
        res.locals.tokenUsage = {
          tokensReserved: 2500,
          windowStartTimestamp: 1000,
        };

        next();
      });

      const vagueError = new BadRequestError("Input is too vague to parse", {
        type: PARSE_TASK_VAGUE_INPUT_ERROR,
        suggestions: ["Be more specific"],
        openaiMetadata: {
          core: {
            tokens: { input: 10, output: 5 },
          },
        },
      });
      mockedExecuteCapability.mockRejectedValue(vagueError);

      const response = await request(app).post(createTaskUrl).send({
        naturalLanguage: mockNaturalLanguage,
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body).toMatchObject({
        tasksServiceRequestId: expect.any(String),
        suggestions: vagueError.context?.suggestions,
      });
      expect(mockOpenaiUpdateTokenUsage).toHaveBeenCalledTimes(1);
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

  describe("getTasks", () => {
    const getTasksUrl = "/api/v1/tasks";

    beforeEach(async () => {
      const { findTasks } = await import("@repositories/tasks-repository");
      vi.mocked(findTasks).mockResolvedValue(mockFindTasksResult);
    });

    it("should return 200 with paginated tasks for valid query parameters", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query(mockGetTasksInputQuery);

      expect(response.status).toBe(StatusCodes.OK);

      const expectedBody: GetTasksResponse = {
        tasksServiceRequestId: expect.any(String),
        tasks: expect.any(Array),
        pagination: {
          totalCount: expect.any(Number),
          skip: expect.any(Number),
          take: expect.any(Number),
          hasMore: expect.any(Boolean),
          currentPage: expect.any(Number),
          totalPages: expect.any(Number),
        },
      };

      expect(response.body).toMatchObject(expectedBody);
    });

    it("should return 200 with default pagination when no query parameters provided", async () => {
      const response = await request(app).get(getTasksUrl);

      expect(response.status).toBe(StatusCodes.OK);

      const expectedBody: GetTasksResponse = {
        tasksServiceRequestId: expect.any(String),
        tasks: expect.any(Array),
        pagination: {
          totalCount: expect.any(Number),
          skip: GET_TASKS_DEFAULT_SKIP,
          take: GET_TASKS_DEFAULT_TAKE,
          hasMore: expect.any(Boolean),
          currentPage: expect.any(Number),
          totalPages: expect.any(Number),
        },
      };

      expect(response.body).toMatchObject(expectedBody);
    });

    it("should filter by category when provided", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          category: "work",
        });

      expect(response.status).toBe(StatusCodes.OK);

      const { findTasks } = await import("@repositories/tasks-repository");
      expect(vi.mocked(findTasks)).toHaveBeenCalledWith(
        expect.anything(),
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            category: "work",
          }),
        })
      );
    });

    it("should filter by priorityLevel when provided", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          priorityLevel: "high",
        });

      expect(response.status).toBe(StatusCodes.OK);

      const { findTasks } = await import("@repositories/tasks-repository");
      expect(vi.mocked(findTasks)).toHaveBeenCalledWith(
        expect.anything(),
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            priorityLevel: "high",
          }),
        })
      );
    });

    it.each(GET_TASKS_ALLOWED_ORDER_BY_FIELDS.map((orderBy) => [orderBy]))(
      "should support orderBy field: %s",
      async (orderBy) => {
        const response = await request(app)
          .get(getTasksUrl)
          .query({
            ...mockGetTasksInputQuery,
            orderBy,
          });

        expect(response.status).toBe(StatusCodes.OK);
      }
    );

    it.each(
      GET_TASKS_ALLOWED_ORDER_DIRECTIONS.map((orderDirection) => [
        orderDirection,
      ])
    )("should support orderDirection: %s", async (orderDirection) => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          orderDirection,
        });

      expect(response.status).toBe(StatusCodes.OK);
    });

    it("should return 400 for invalid orderBy value", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          orderBy: "invalidField",
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid orderDirection value", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          orderDirection: "invalid",
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid skip value (negative)", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          skip: -1,
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid take value (too large)", async () => {
      const response = await request(app)
        .get(getTasksUrl)
        .query({
          ...mockGetTasksInputQuery,
          take: 101,
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBeDefined();
    });
  });
});
