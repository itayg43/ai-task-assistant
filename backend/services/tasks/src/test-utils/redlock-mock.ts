import Redlock from "redlock";
import { Mock, vi } from "vitest";

export const createRedlockClientMock = (): Partial<Redlock> => ({
  acquire: vi.fn(),
});

export const setupAcquireMock = (
  mockRedlockClient: Partial<Redlock>,
  value: unknown,
  shouldResolve: boolean = true
) => {
  if (shouldResolve) {
    (mockRedlockClient.acquire as Mock).mockResolvedValue(value);
  } else {
    (mockRedlockClient.acquire as Mock).mockRejectedValue(value);
  }
};
