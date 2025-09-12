type ScoreRange = {
  min: number;
  max: number;
};

export type ParseTaskConfig = {
  categories: string[];
  priorities: {
    levels: string[];
    scores: Record<string, ScoreRange>;
    overallScoreRange: ScoreRange;
  };
  frequencies: string[];
};
