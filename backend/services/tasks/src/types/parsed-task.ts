export type TParsedTask = {
  title: string;
  dueDate: string | null;
  category: string;
  priority: {
    level: string;
    score: number;
    reason: string;
  };
  subtasks: string[] | null;
};
