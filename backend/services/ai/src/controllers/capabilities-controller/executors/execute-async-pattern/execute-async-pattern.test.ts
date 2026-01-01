import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockParseTaskCapabilityConfig } from "@capabilities/parse-task/parse-task-mocks";
import { publishJob } from "@clients/rabbitmq";
import { RABBITMQ_QUEUE } from "@constants";
import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { mockAsyncPatternInput } from "@mocks/capabilities-controller-mocks";
import { mockAiServiceRequestId } from "@mocks/request-ids";
import { InternalError } from "@shared/errors";
import { Mocked } from "@shared/types";
import { CapabilityConfig } from "@types";

vi.mock("@clients/rabbitmq", () => ({
  publishJob: vi.fn(),
}));

describe("executeAsyncPattern", () => {
  let mockedPublishJob: Mocked<typeof publishJob>;
  let mockConfig: CapabilityConfig<any, any>;

  beforeEach(() => {
    mockConfig = mockParseTaskCapabilityConfig;

    mockedPublishJob = vi.mocked(publishJob);
    mockedPublishJob.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("success cases", () => {
    it("should publish job to RabbitMQ with correct payload", async () => {
      const result = await executeAsyncPattern(
        mockConfig,
        mockAsyncPatternInput,
        mockAiServiceRequestId
      );

      expect(publishJob).toHaveBeenCalledWith(
        RABBITMQ_QUEUE.AI_CAPABILITY_JOBS,
        {
          capability: mockAsyncPatternInput.params.capability,
          input: mockAsyncPatternInput,
          requestId: mockAiServiceRequestId,
        }
      );
      expect(result).toEqual({});
    });
  });

  describe("error handling", () => {
    it("should throw InternalError when publishJob fails", async () => {
      const mockError = new Error("RabbitMQ connection failed");

      mockedPublishJob.mockRejectedValue(mockError);

      await expect(
        executeAsyncPattern(
          mockConfig,
          mockAsyncPatternInput,
          mockAiServiceRequestId
        )
      ).rejects.toThrow(InternalError);

      expect(publishJob).toHaveBeenCalled();
    });
  });
});
