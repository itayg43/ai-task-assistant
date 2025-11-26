export type TParseTaskConfigScoreRange = {
  min: number;
  max: number;
};

export type TParseTaskConfig = {
  categories: string[];
  priorities: {
    levels: string[];
    scores: Record<string, TParseTaskConfigScoreRange>;
    overallScoreRange: TParseTaskConfigScoreRange;
  };
};
