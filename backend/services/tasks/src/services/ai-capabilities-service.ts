import { ai } from "@clients/ai";
import { env } from "@config/env";

const AI_CAPABILITIES_ROUTE = `${env.AI_SERVICE_URL}/capabilities`;

export const parseTask = async (naturalLanguage: string) => {
  const { data } = await ai.post(
    `${AI_CAPABILITIES_ROUTE}/parse-task?pattern=sync`,
    {
      naturalLanguage,
    }
  );

  return data;
};
