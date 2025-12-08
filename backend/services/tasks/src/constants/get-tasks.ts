import { TaskOrderByFields } from "@repositories/tasks-repository";
import { Prisma } from "@shared/clients/prisma";

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

export const GET_TASKS_MIN_TAKE = 1;
export const GET_TASKS_MAX_TAKE = 100;
