import Redlock from "redlock";
import { Mock, vi } from "vitest";

export const createRedlockClientMock = (): Redlock =>
  ({
    acquire: vi.fn(),
  } as unknown as Redlock);

export const setupAcquireMock = (
  mockRedlockClient: Redlock,
  value: unknown,
  shouldResolve: boolean = true
) => {
  if (shouldResolve) {
    (mockRedlockClient.acquire as Mock).mockResolvedValue(value);
  } else {
    (mockRedlockClient.acquire as Mock).mockRejectedValue(value);
  }
};
