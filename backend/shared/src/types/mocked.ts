import { vi } from "vitest";

export type Mocked<T> = ReturnType<typeof vi.mocked<T>>;
