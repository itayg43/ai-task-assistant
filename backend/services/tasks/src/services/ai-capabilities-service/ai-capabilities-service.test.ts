import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aiClient } from "@clients/ai";
import {
  mockAiCapabilityImmediateResponse,
  mockParsedTaskExecuteCapabilityConfig,
  mockRequestId,
} from "@mocks/tasks-mocks";
import { executeCapability } from "@services/ai-capabilities-service";
import { InternalError } from "@shared/errors";

vi.mock("@clients/ai", () => ({
  aiClient: {
    post: vi.fn(),
  },
}));

describe("executeCapability", () => {
  let mockAiClientPost: ReturnType<typeof vi.fn>;
  let mockExecuteCapabilityUrl: string;

  beforeEach(() => {
    mockAiClientPost = vi.mocked(aiClient.post);
    mockExecuteCapabilityUrl = `/capabilities/parse-task?callbackUrl=${mockParsedTaskExecuteCapabilityConfig.callbackUrl}`;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully execute capability via async pattern and return immediate response with message and aiServiceRequestId", async () => {
    mockAiClientPost.mockResolvedValue({
      data: mockAiCapabilityImmediateResponse,
    });

    const result = await executeCapability(
      mockRequestId,
      mockParsedTaskExecuteCapabilityConfig
    );

    expect(mockAiClientPost).toHaveBeenCalledWith(
      mockExecuteCapabilityUrl,
      mockParsedTaskExecuteCapabilityConfig.params
    );
    expect(result).toEqual(mockAiCapabilityImmediateResponse);
  });

  it("should propagate error when the request call fails", async () => {
    const mockError = new Error("Network error");
    mockAiClientPost.mockRejectedValue(mockError);

    await expect(
      executeCapability(mockRequestId, mockParsedTaskExecuteCapabilityConfig)
    ).rejects.toThrow(expect.any(Error));
  });
});
