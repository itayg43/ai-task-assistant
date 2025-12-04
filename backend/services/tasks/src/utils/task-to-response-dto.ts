import { type TaskWithSubtasks } from "@repositories/tasks-repository";
import { type TaskResponse } from "@types";

export const taskToResponseDto = (task: TaskWithSubtasks): TaskResponse => {
  const { id, title, dueDate, category, createdAt, updatedAt, subtasks } = task;

  return {
    id,
    title,
    dueDate,
    category,
    priority: {
      level: task.priorityLevel,
      score: task.priorityScore,
      reason: task.priorityReason,
    },
    createdAt,
    updatedAt,
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      order: subtask.order,
    })),
  };
};
