import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTask } from "@controllers/tasks-controller";
import {
  mockNaturalLanguage,
  mockParsedTask,
  mockRequestId,
} from "@mocks/tasks-mocks";
import { createTaskHandler } from "@services/tasks-service";
import { Mocked } from "@shared/types";

vi.mock("@services/tasks-service", () => ({
  createTaskHandler: vi.fn(),
}));

describe("tasksController (unit)", () => {
  let mockedCreateTaskHandler: Mocked<typeof createTaskHandler>;

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockedCreateTaskHandler = vi.mocked(createTaskHandler);
    mockedCreateTaskHandler.mockResolvedValue(mockParsedTask);

    mockRequest = {
      body: {
        naturalLanguage: mockNaturalLanguage,
      },
    };

    mockResponse = {
      locals: {
        requestId: mockRequestId,
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully create task and return 201 with correct response structure", async () => {
    await createTask(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockedCreateTaskHandler).toHaveBeenCalledWith(
      mockRequestId,
      mockNaturalLanguage
    );
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(mockResponse.json).toHaveBeenCalledWith({
      tasksServiceRequestId: mockRequestId,
      ...mockParsedTask,
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should handle errors from createTaskHandler and pass to next", async () => {
    const mockError = new Error("Task creation failed");
    mockedCreateTaskHandler.mockRejectedValue(mockError);

    await createTask(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalledWith(mockError);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
