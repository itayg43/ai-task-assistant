export type ParseTaskConfig = {
  categories: string[];
  priorities: {
    levels: string[];
    overallScoreRange: {
      min: number;
      max: number;
    };
  };
  frequencies: string[];
};
