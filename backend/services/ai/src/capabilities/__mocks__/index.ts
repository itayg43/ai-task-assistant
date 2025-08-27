import { vi } from "vitest";

import { CAPABILITY } from "@shared/constants";

export const capabilities = {
  [CAPABILITY.PARSE_TASK]: {
    name: CAPABILITY.PARSE_TASK,
    handler: vi.fn(),
    inputSchema: {
      parse: vi.fn(),
    },
    outputSchema: {
      parse: vi.fn(),
    },
  },
};
