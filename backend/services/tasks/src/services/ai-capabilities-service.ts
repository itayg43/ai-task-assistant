import { ai } from "@clients/ai";
import { env } from "@config/env";
import { AiCapabilityResponse, ParsedTask, ParseTaskConfig } from "@types";

const AI_CAPABILITIES_ROUTE = `${env.AI_SERVICE_URL}/capabilities`;

export const parseTask = async (
  naturalLanguage: string,
  config: ParseTaskConfig
): Promise<AiCapabilityResponse<ParsedTask>> => {
  const { data } = await ai.post(
    `${AI_CAPABILITIES_ROUTE}/parse-task?pattern=sync`,
    {
      naturalLanguage,
      config,
    }
  );

  return data;
};
