import z from "zod";

import {
  GET_TASKS_ALLOWED_ORDER_BY_FIELDS,
  GET_TASKS_ALLOWED_ORDER_DIRECTIONS,
  GET_TASKS_DEFAULT_SKIP,
  GET_TASKS_DEFAULT_TAKE,
  GET_TASKS_MAX_TAKE,
  GET_TASKS_MIN_TAKE,
} from "@constants";
import { TaskOrderByFields } from "@repositories/tasks-repository";
import { Prisma } from "@shared/clients/prisma";

export const createTaskRequestInputSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().trim().nonempty(),
  }),
});

export const getTasksInputSchema = z.object({
  query: z
    .object({
      skip: z.coerce.number().int().min(GET_TASKS_DEFAULT_SKIP).nullish(),
      take: z.coerce
        .number()
        .int()
        .min(GET_TASKS_MIN_TAKE)
        .max(GET_TASKS_MAX_TAKE)
        .nullish(),
      orderBy: z.enum(GET_TASKS_ALLOWED_ORDER_BY_FIELDS).nullish(),
      orderDirection: z.enum(GET_TASKS_ALLOWED_ORDER_DIRECTIONS).nullish(),
      category: z.string().nullish(),
      priorityLevel: z.string().nullish(),
    })
    .transform((data) => ({
      skip: data.skip ?? GET_TASKS_DEFAULT_SKIP,
      take: data.take ?? GET_TASKS_DEFAULT_TAKE,
      orderBy: (data.orderBy ?? "createdAt") satisfies TaskOrderByFields,
      orderDirection: (data.orderDirection ??
        "desc") satisfies Prisma.SortOrder,
      category: data.category || undefined,
      priorityLevel: data.priorityLevel || undefined,
    }))
    .pipe(
      z.object({
        skip: z.number().int().min(GET_TASKS_DEFAULT_SKIP),
        take: z.number().int().min(GET_TASKS_MIN_TAKE).max(GET_TASKS_MAX_TAKE),
        orderBy: z.enum(GET_TASKS_ALLOWED_ORDER_BY_FIELDS),
        orderDirection: z.enum(GET_TASKS_ALLOWED_ORDER_DIRECTIONS),
        category: z.string().optional(),
        priorityLevel: z.string().optional(),
      })
    ),
});

const extractedErrorInfoSchema = z.object({
  status: z.number(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()),
});

const createTaskErrorInputSchema = z.object({
  success: z.literal(false),
  error: extractedErrorInfoSchema,
  aiServiceRequestId: z.string(),
});

export const openaiMetadataSchema = z.object({
  responseId: z.string(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
  }),
  durationMs: z.number(),
});

export const openaiMetadataRecordSchema = z.record(
  z.string(),
  openaiMetadataSchema
);

export const parsedTaskSchema = z.object({
  title: z.string(),
  dueDate: z.string().nullable(),
  category: z.string(),
  priority: z.object({
    level: z.string(),
    score: z.number(),
    reason: z.string(),
  }),
  subtasks: z.array(z.string()).nullable(),
});

const createTaskSuccessInputSchema = z.object({
  success: z.literal(true),
  result: z.object({
    openaiMetadata: openaiMetadataRecordSchema,
    result: parsedTaskSchema,
  }),
  aiServiceRequestId: z.string(),
});

export const createTaskWebhookInputSchema = z.object({
  body: z.discriminatedUnion("success", [
    createTaskErrorInputSchema,
    createTaskSuccessInputSchema,
  ]),
});
