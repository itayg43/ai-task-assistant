import z from "zod";

import { Prisma } from "@shared/clients/prisma";
import { TaskOrderByFields } from "@repositories/tasks-repository";

export const createTaskSchema = z.object({
  body: z.object({
    naturalLanguage: z.string().nonempty(),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

const ORDER_BY_FIELDS: [TaskOrderByFields, ...TaskOrderByFields[]] = [
  "dueDate",
  "priorityScore",
  "createdAt",
];

const ORDER_DIRECTIONS: [Prisma.SortOrder, Prisma.SortOrder] = ["asc", "desc"];

const DEFAULT_SKIP = 0;
const DEFAULT_TAKE = 10;
const MIN_TAKE = 1;
const MAX_TAKE = 100;

export const getTasksSchema = z.object({
  query: z
    .object({
      skip: z.string().nullish(),
      take: z.string().nullish(),
      orderBy: z.enum(ORDER_BY_FIELDS).nullish(),
      orderDirection: z.enum(ORDER_DIRECTIONS).nullish(),
      category: z.string().nullish(),
      priorityLevel: z.string().nullish(),
    })
    .transform((data) => ({
      skip: data.skip ? parseInt(data.skip) : DEFAULT_SKIP,
      take: data.take ? parseInt(data.take) : DEFAULT_TAKE,
      orderBy: (data.orderBy || "createdAt") as TaskOrderByFields,
      orderDirection: (data.orderDirection || "desc") as Prisma.SortOrder,
      category: data.category || undefined,
      priorityLevel: data.priorityLevel || undefined,
    }))
    .pipe(
      z.object({
        skip: z.number().int().min(DEFAULT_SKIP),
        take: z.number().int().min(MIN_TAKE).max(MAX_TAKE),
        orderBy: z.enum(ORDER_BY_FIELDS),
        orderDirection: z.enum(ORDER_DIRECTIONS),
        category: z.string().optional(),
        priorityLevel: z.string().optional(),
      })
    ),
});

export type GetTasksInput = z.infer<typeof getTasksSchema>;
