import z from "zod";

import {
  AI_ERROR_TYPE,
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
      }),
    ),
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
  openaiMetadataSchema,
);

const createTaskAiErrorContext = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(AI_ERROR_TYPE.PARSE_TASK_VAGUE_INPUT_ERROR),
    suggestions: z.array(z.string().nonempty()),
    openaiMetadata: openaiMetadataRecordSchema,
  }),
  z.object({
    type: z.literal(AI_ERROR_TYPE.OPENAI_API_ERROR),
    openaiRequestId: z.string().optional(),
  }),
  z.object({
    type: z.literal(AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED),
  }),
]);

const extractedErrorInfoSchema = z.object({
  status: z.number(),
  message: z.string().nonempty(),
  context: createTaskAiErrorContext,
});

const createTaskErrorInputSchema = z.object({
  success: z.literal(false),
  error: extractedErrorInfoSchema,
  aiServiceRequestId: z.string(),
});

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
  query: z.object({
    tasksServiceRequestId: z.string().uuid(),
  }),
  body: z.discriminatedUnion("success", [
    createTaskErrorInputSchema,
    createTaskSuccessInputSchema,
  ]),
});
