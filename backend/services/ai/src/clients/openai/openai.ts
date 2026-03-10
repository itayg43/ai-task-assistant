import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { env } from "@config/env";
import { InternalError } from "@shared/errors";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const parseWithValidation = async <TOutput>(
  prompt: ResponseCreateParamsNonStreaming,
  onResponseReceived?: (id: string) => void,
) => {
  const response = await openai.responses.parse<ResponseCreateParamsNonStreaming, TOutput>(prompt);

  if (onResponseReceived) {
    onResponseReceived(response.id);
  }

  if (response.status !== "completed") {
    throw new InternalError("OpenAI returned an uncompleted response.");
  }

  if (!response.output_parsed) {
    throw new InternalError("OpenAI failed to parse the output correctly.");
  }

  return response as typeof response & { output_parsed: TOutput };
};
