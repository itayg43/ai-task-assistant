import { TOpenaiMetadataRecord } from "@types";

export const extractOpenaiTokenUsage = (
  openaiMetadata: TOpenaiMetadataRecord,
) => {
  let totalTokens = 0;

  Object.values(openaiMetadata).forEach(({ tokens }) => {
    totalTokens += tokens.input + tokens.output;
  });

  return totalTokens;
};
