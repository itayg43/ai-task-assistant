import z from "zod";

import { capabilitiesQueueMessageDataSchema } from "@schemas";

export type CapabilitiesQueueMessageData = z.infer<
  typeof capabilitiesQueueMessageDataSchema
>;
