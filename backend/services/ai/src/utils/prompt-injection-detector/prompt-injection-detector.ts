import { AI_ERROR_TYPE } from "@constants";
import { recordPromptInjectionBlocked } from "@metrics/prompt-injection-metrics";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError } from "@shared/errors";

const logger = createLogger("promptInjectionDetector");

const INSTRUCTION_OVERRIDE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/i,
  /forget\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/i,
  /override\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/i,
  /you\s+are\s+now/i,
  /your\s+new\s+(role|task|instructions?)/i,
  /act\s+as\s+(if\s+)?you\s+are/i,
];

const PROMPT_EXTRACTION_PATTERNS = [
  /(repeat|echo|show|display|print|output)\s+(all\s+)?(your\s+)?(instructions?|prompt|system\s*message)/i,
  /what\s+are\s+(your\s+)?(\w+\s+)*(instructions?|prompt|system\s*message)/i,
  /tell\s+me\s+(your\s+)?(\w+\s+)*(instructions?|prompt|system\s*message)/i,
];

const OUTPUT_OVERRIDE_PATTERNS = [
  /instead\s*,?\s*(return|set|make|assign|output|give|respond)\s+/i,
];

const FORMAT_MANIPULATION_PATTERNS = [
  /##\s*instructions?/i,
  /```\s*(instructions?|prompt|system)[^`]*```/i,
];

const INJECTION_PATTERNS = [
  ...INSTRUCTION_OVERRIDE_PATTERNS,
  ...PROMPT_EXTRACTION_PATTERNS,
  ...OUTPUT_OVERRIDE_PATTERNS,
  ...FORMAT_MANIPULATION_PATTERNS,
];

const PATTERN_TYPE_MAP = new Map<RegExp, string>([
  ...INSTRUCTION_OVERRIDE_PATTERNS.map(
    (p) => [p, "instruction_override"] as const
  ),
  ...PROMPT_EXTRACTION_PATTERNS.map((p) => [p, "prompt_extraction"] as const),
  ...OUTPUT_OVERRIDE_PATTERNS.map((p) => [p, "output_override"] as const),
  ...FORMAT_MANIPULATION_PATTERNS.map(
    (p) => [p, "format_manipulation"] as const
  ),
]);

export const detectInjection = (input: string, requestId: string): string => {
  const trimmedInput = input.trim();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmedInput)) {
      const patternType = PATTERN_TYPE_MAP.get(pattern)!;

      logger.error("Prompt injection detected and blocked", {
        requestId,
        patternType,
        input: trimmedInput,
      });

      recordPromptInjectionBlocked(patternType);

      throw new BadRequestError(
        "Invalid input: Potential prompt injection detected.",
        {
          type: AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED,
        }
      );
    }
  }

  return trimmedInput;
};
