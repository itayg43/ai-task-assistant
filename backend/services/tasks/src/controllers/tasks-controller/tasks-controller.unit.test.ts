import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTask, getTasks } from "@controllers/tasks-controller";
import { CreateTaskResponse, GetTasksResponse } from "@types";
import {
  mockFindTasksResult,
  mockGetTasksInputQuery,
  mockNaturalLanguage,
  mockRequestId,
  mockTaskWithSubtasks,
  mockUserId,
} from "@mocks/tasks-mocks";
import { GetTasksInput } from "@schemas/tasks-schemas";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import { Mocked } from "@shared/types";
import { taskToResponseDto } from "@utils/task-to-response-dto";

vi.mock("@services/tasks-service", () => ({
  createTaskHandler: vi.fn(),
  getTasksHandler: vi.fn(),
}));

describe("tasksController (unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};

    mockResponse = {
      locals: {
        requestId: mockRequestId,
        authenticationContext: {
          userId: mockUserId,
        },
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTaskHandler", () => {
    let mockedCreateTaskHandler: Mocked<typeof createTaskHandler>;

    beforeEach(() => {
      mockRequest = {
        body: {
          naturalLanguage: mockNaturalLanguage,
        },
      };

      mockedCreateTaskHandler = vi.mocked(createTaskHandler);
      mockedCreateTaskHandler.mockResolvedValue(mockTaskWithSubtasks);
    });

    it("should successfully create task and return 201 with correct response structure", async () => {
      await createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedCreateTaskHandler).toHaveBeenCalledWith(
        mockRequestId,
        mockUserId,
        mockNaturalLanguage
      );
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED);

      const response: CreateTaskResponse = {
        tasksServiceRequestId: mockRequestId,
        task: taskToResponseDto(mockTaskWithSubtasks),
      };
      expect(mockResponse.json).toHaveBeenCalledWith(response);

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

  describe("getTasks", () => {
    let mockedGetTasksHandler: Mocked<typeof getTasksHandler>;

    beforeEach(() => {
      mockResponse.locals!.validatedQuery = {
        ...mockGetTasksInputQuery,
        category: "work",
        priorityLevel: "high",
      };

      mockedGetTasksHandler = vi.mocked(getTasksHandler);
      mockedGetTasksHandler.mockResolvedValue(mockFindTasksResult);
    });

    it("should successfully get tasks and return 200 with paginated response", async () => {
      await getTasks(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockedGetTasksHandler).toHaveBeenCalledWith(mockUserId, {
        ...mockGetTasksInputQuery,
        where: {
          category: "work",
          priorityLevel: "high",
        },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);

      const response: GetTasksResponse = {
        tasksServiceRequestId: mockRequestId,
        tasks: [taskToResponseDto(mockTaskWithSubtasks)],
        pagination: {
          totalCount: 1,
          skip: 0,
          take: 10,
          hasMore: false,
          currentPage: 1,
          totalPages: 1,
        },
      };
      expect(mockResponse.json).toHaveBeenCalledWith(response);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle empty results correctly", async () => {
      mockedGetTasksHandler.mockResolvedValue({
        tasks: [],
        totalCount: 0,
        hasMore: false,
      });

      await getTasks(mockRequest as any, mockResponse as Response, mockNext);

      const response: GetTasksResponse = {
        tasksServiceRequestId: mockRequestId,
        tasks: [],
        pagination: {
          totalCount: 0,
          skip: 0,
          take: 10,
          hasMore: false,
          currentPage: 1,
          totalPages: 0,
        },
      };
      expect(mockResponse.json).toHaveBeenCalledWith(response);
    });

    it("should handle errors from getTasksHandler and pass to next", async () => {
      const mockError = new Error("Failed to get tasks");
      mockedGetTasksHandler.mockRejectedValue(mockError);

      await getTasks(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
