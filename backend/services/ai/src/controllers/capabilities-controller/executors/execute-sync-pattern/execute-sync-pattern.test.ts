import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  mockParseTaskCapabilityConfig,
  mockParseTaskCapabilityResponse,
  mockParseTaskValidatedInput,
} from "@capabilities/parse-task/parse-task-mocks";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { InternalError } from "@shared/errors";
import { CapabilityConfig } from "@types";

describe("executeSyncPattern", () => {
  let mockParse: ReturnType<typeof vi.fn>;
  let mockConfig: CapabilityConfig<any, any>;

  const mockInput = mockParseTaskValidatedInput;
  const mockResult = mockParseTaskCapabilityResponse;

  beforeEach(() => {
    mockParse = vi.fn();
    mockConfig = {
      ...mockParseTaskCapabilityConfig,
      outputSchema: {
        ...mockParseTaskCapabilityConfig.outputSchema,
        parse: mockParse,
      } as any,
    };

    vi.spyOn(mockConfig, "handler");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute handler and return parsed result", async () => {
    mockParse.mockReturnValue(mockResult);

    const result = await executeSyncPattern(
      mockConfig,
      mockInput,
      mockAiServiceRequestId
    );

    expect(mockConfig.handler).toHaveBeenCalledWith(
      mockInput,
      mockAiServiceRequestId
    );
    expect(mockParse).toHaveBeenCalledWith(mockResult);
    expect(result).toEqual(mockResult);
  });

  it("should throw InternalError when output schema validation fails immediately", async () => {
    const mockZodErrorMessage = "invalid output";
    const mockZodError = new ZodError([
      {
        code: "custom",
        message: mockZodErrorMessage,
        path: [],
      },
    ]);

    mockParse.mockImplementation(() => {
      throw mockZodError;
    });

    await expect(
      executeSyncPattern(mockConfig, mockInput, mockAiServiceRequestId)
    ).rejects.toThrow(InternalError);
  });
});
