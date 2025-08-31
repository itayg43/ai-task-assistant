import { ai } from "@clients/ai";
import { AI_CAPABILITIES_ROUTE } from "@constants";

export const parseTask = async (naturalLanguage: string) => {
  const { data } = await ai.post(
    `${AI_CAPABILITIES_ROUTE}/parse-task?pattern="sync"`,
    {
      naturalLanguage,
    }
  );

  return data;
};
