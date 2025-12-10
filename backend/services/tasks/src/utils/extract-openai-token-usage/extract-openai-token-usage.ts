import { TAiCapabilityResponse } from "@types";

export const extractOpenaiTokenUsage = <TResult>(
  openaiMetadata: TAiCapabilityResponse<TResult>["openaiMetadata"]
) => {
  let totalTokens = 0;

  Object.values(openaiMetadata).forEach(({ tokens }) => {
    totalTokens += tokens.input + tokens.output;
  });

  return totalTokens;
};
