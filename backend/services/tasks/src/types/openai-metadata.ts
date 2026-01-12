import z from "zod";

import { openaiMetadataRecordSchema, openaiMetadataSchema } from "@schemas";

export type TOpenaiMetadata = z.infer<typeof openaiMetadataSchema>;

export type TOpenaiMetadataRecord = z.infer<typeof openaiMetadataRecordSchema>;
