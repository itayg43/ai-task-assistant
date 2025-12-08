import z from "zod";

import { Prisma } from "@shared/clients/prisma";
import { TaskOrderByFields } from "@repositories/tasks-repository";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().nonempty(),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const GET_TASKS_ALLOWED_ORDER_BY_FIELDS: [
  TaskOrderByFields,
  ...TaskOrderByFields[]
] = ["dueDate", "priorityScore", "createdAt"];

export const GET_TASKS_ALLOWED_ORDER_DIRECTIONS: [
  Prisma.SortOrder,
  Prisma.SortOrder
] = ["asc", "desc"];

export const GET_TASKS_DEFAULT_SKIP = 0;
export const GET_TASKS_DEFAULT_TAKE = 10;
const MIN_TAKE = 1;
const MAX_TAKE = 100;

export const getTasksSchema = z.object({
  query: z
    .object({
      skip: z.coerce.number().int().min(GET_TASKS_DEFAULT_SKIP).nullish(),
      take: z.coerce.number().int().min(MIN_TAKE).max(MAX_TAKE).nullish(),
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
        take: z.number().int().min(MIN_TAKE).max(MAX_TAKE),
        orderBy: z.enum(GET_TASKS_ALLOWED_ORDER_BY_FIELDS),
        orderDirection: z.enum(GET_TASKS_ALLOWED_ORDER_DIRECTIONS),
        category: z.string().optional(),
        priorityLevel: z.string().optional(),
      })
    ),
});

export type GetTasksInput = z.infer<typeof getTasksSchema>;
