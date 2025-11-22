export type ParseTaskConfigScoreRange = {
  min: number;
  max: number;
};

export type ParseTaskConfig = {
  categories: string[];
  priorities: {
    levels: string[];
    scores: Record<string, ParseTaskConfigScoreRange>;
    overallScoreRange: ParseTaskConfigScoreRange;
  };
};
