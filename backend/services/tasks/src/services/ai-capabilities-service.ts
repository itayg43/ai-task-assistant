import { ai } from "@clients/ai";
import { AI_CAPABILITIES_ROUTE } from "@constants";

export const parseTask = async (naturalLanguage: string, pattern = "sync") => {
  const { data } = await ai.post(
    `${AI_CAPABILITIES_ROUTE}/parse-task?pattern=${pattern}`,
    {
      naturalLanguage,
    }
  );

  return data;
};
