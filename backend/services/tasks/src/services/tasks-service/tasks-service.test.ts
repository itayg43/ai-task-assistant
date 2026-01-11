import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@clients/prisma";
import {
  mockAiCapabilityImmediateResponse,
  mockFindTasksResult,
  mockGetTasksInputQuery,
  mockNaturalLanguage,
  mockParsedTaskExecuteCapabilityConfig,
  mockRequestId,
  mockUserId,
} from "@mocks/tasks-mocks";
import { findTasks } from "@repositories/tasks-repository";
import { executeCapability } from "@services/ai-capabilities-service";
import { createTaskHandler, getTasksHandler } from "@services/tasks-service";
import type { Mocked } from "@shared/types";

vi.mock("@clients/prisma", () => ({
  prisma: {},
}));

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
}));

vi.mock("@repositories/tasks-repository", () => ({
  findTasks: vi.fn(),
}));

describe("tasksService", () => {
  describe("createTaskHandler", () => {
    let mockedExecuteCapability: Mocked<typeof executeCapability>;

    beforeEach(() => {
      mockedExecuteCapability = vi.mocked(executeCapability);
      mockedExecuteCapability.mockResolvedValue(
        mockAiCapabilityImmediateResponse
      );
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should call executeCapability with correct parameters and return message", async () => {
      const result = await createTaskHandler(
        mockRequestId,
        mockNaturalLanguage
      );

      expect(mockedExecuteCapability).toHaveBeenCalledWith(
        mockRequestId,
        mockParsedTaskExecuteCapabilityConfig
      );
      expect(result).toEqual(mockAiCapabilityImmediateResponse.message);
    });

    it("should propagate errors from executeCapability", async () => {
      const mockError = new Error("AI service error");
      mockedExecuteCapability.mockRejectedValue(mockError);

      await expect(
        createTaskHandler(mockRequestId, mockNaturalLanguage)
      ).rejects.toThrow(mockError);
    });
  });

  describe("getTasksHandler", () => {
    let mockedFindTasks: Mocked<typeof findTasks>;

    beforeEach(() => {
      mockedFindTasks = vi.mocked(findTasks);
      mockedFindTasks.mockResolvedValue(mockFindTasksResult);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should call findTasks with correct parameters and return result", async () => {
      const result = await getTasksHandler(mockUserId, mockGetTasksInputQuery);

      expect(mockedFindTasks).toHaveBeenCalledWith(
        prisma,
        mockUserId,
        mockGetTasksInputQuery
      );
      expect(result).toEqual(mockFindTasksResult);
    });

    it("should propagate errors from findTasks", async () => {
      const mockError = new Error("Repository error");
      mockedFindTasks.mockRejectedValue(mockError);

      await expect(
        getTasksHandler(mockUserId, mockGetTasksInputQuery)
      ).rejects.toThrow(mockError);
    });
  });
});
