import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { env } from "@config/env";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const executeParse = <TOutput>(
  prompt: ResponseCreateParamsNonStreaming
) => {
  return openai.responses.parse<any, TOutput>(prompt);
};
