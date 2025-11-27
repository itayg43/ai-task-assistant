import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAiCapabilityResponse,
  mockNaturalLanguage,
  mockParsedTask,
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
    AI_SERVICE_URL: "http://ai-service:3000",
    REDIS_URL: "redis://localhost:6379",
    REDIS_CONNECT_TIMEOUT_MS: 10000,
    REDIS_READY_TIMEOUT_MS: 10000,
    REDLOCK_RETRY_COUNT: 3,
    REDLOCK_RETRY_DELAY_MS: 100,
    REDLOCK_RETRY_JITTER_MS: 10,
    GLOBAL_TOKEN_BUCKET_RATE_LIMITER_NAME: "global",
    GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_SIZE: 100,
    GLOBAL_TOKEN_BUCKET_RATE_LIMITER_REFILL_RATE: 10,
    GLOBAL_TOKEN_BUCKET_RATE_LIMITER_BUCKET_TTL_SECONDS: 3600,
    GLOBAL_TOKEN_BUCKET_RATE_LIMITER_LOCK_TTL_MS: 500,
  },
}));

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
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
    res.locals.authenticationContext = { userId: 1 };
    next();
  },
}));

describe("tasksController (integration)", () => {
  let mockedExecuteCapability: Mocked<typeof executeCapability>;

  const createTaskUrl = "/api/v1/tasks/create";

  beforeEach(() => {
    mockedExecuteCapability = vi.mocked(executeCapability);

    mockTokenBucketRateLimiter.mockImplementation((_req, _res, next) => next());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 201 with parsed task for valid input", async () => {
    mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);

    const response = await request(app).post(createTaskUrl).send({
      naturalLanguage: mockNaturalLanguage,
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.tasksServiceRequestId).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      tasksServiceRequestId: expect.any(String),
      ...mockParsedTask,
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
