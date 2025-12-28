import { vi } from "vitest";

export const cors = vi.fn((_req: any, _res: any, next: any) => next());
