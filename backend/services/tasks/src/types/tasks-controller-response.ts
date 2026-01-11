import { TaskResponse } from "./task-response";

type BaseTaskControllerResponse = {
  tasksServiceRequestId: string;
};

export type CreateTaskResponse = BaseTaskControllerResponse & {
  message: string;
};

export type GetTasksResponse = BaseTaskControllerResponse & {
  tasks: TaskResponse[];
  pagination: {
    totalCount: number;
    skip: number;
    take: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
};
