type Subtask = {
  id: number;
  title: string;
  order: number;
};

export type TaskResponse = {
  id: number;
  title: string;
  dueDate: Date | null;
  category: string;
  priority: {
    level: string;
    score: number;
    reason: string;
  };
  createdAt: Date;
  updatedAt: Date;
  subtasks: Subtask[];
};
