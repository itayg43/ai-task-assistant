import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARSE_TASK_CONFIG } from "@constants";
import {
  mockAiCapabilityResponse,
  mockNaturalLanguage,
  mockParsedTask,
  mockRequestId,
} from "@mocks/tasks-mocks";
import { executeCapability } from "@services/ai-capabilities-service";
import { createTaskHandler } from "@services/tasks-service";
import { Mocked } from "@shared/types";

vi.mock("@services/ai-capabilities-service", () => ({
  executeCapability: vi.fn(),
}));

describe("createTaskHandler", () => {
  let mockedExecuteCapability: Mocked<typeof executeCapability>;

  beforeEach(() => {
    mockedExecuteCapability = vi.mocked(executeCapability);
    mockedExecuteCapability.mockResolvedValue(mockAiCapabilityResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully call executeCapability with correct parameters", async () => {
    await createTaskHandler(mockRequestId, mockNaturalLanguage);

    expect(mockedExecuteCapability).toHaveBeenCalledWith(mockRequestId, {
      capability: "parse-task",
      pattern: "sync",
      params: {
        naturalLanguage: mockNaturalLanguage,
        config: DEFAULT_PARSE_TASK_CONFIG,
      },
    });
  });

  it("should return parsed task result from AI capability response", async () => {
    const result = await createTaskHandler(mockRequestId, mockNaturalLanguage);

    expect(result).toEqual(mockParsedTask);
  });

  it("should propagate errors from executeCapability", async () => {
    const mockError = new Error("AI service error");
    mockedExecuteCapability.mockRejectedValue(mockError);

    await expect(
      createTaskHandler(mockRequestId, mockNaturalLanguage)
    ).rejects.toThrow(mockError);
  });
});
