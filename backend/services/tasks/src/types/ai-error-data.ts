type TBaseAiErrorData = {
  message: string;
};

export type TAiErrorData = TBaseAiErrorData &
  (
    | {
        type?: undefined;
      }
    | {
        type: "PARSE_TASK_VAGUE_INPUT_ERROR";
        suggestions: string[];
      }
  );
