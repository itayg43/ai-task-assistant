import z from "zod";

import { parsedTaskSchema } from "@schemas";

export type TParsedTask = z.infer<typeof parsedTaskSchema>;
