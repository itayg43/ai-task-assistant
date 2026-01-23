import z from "zod";

import { CAPABILITY } from "@constants";

export const capabilitiesQueueMessageDataSchema = z.object({
  requestId: z.string(),
  capability: z.nativeEnum(CAPABILITY),
  input: z.unknown(),
  callbackUrl: z.string().url(),
  startTime: z.number(),
});
