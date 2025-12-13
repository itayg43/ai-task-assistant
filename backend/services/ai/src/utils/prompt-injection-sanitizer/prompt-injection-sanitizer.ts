import { AI_ERROR_TYPE } from "@constants";
import { createLogger } from "@shared/config/create-logger";
import { BadRequestError } from "@shared/errors";

const logger = createLogger("promptInjectionSanitizer");

const WHITESPACE_NORMALIZATION_PATTERN = /\s+/g;
const MEANINGFUL_CONTENT_PATTERN = /[a-zA-Z0-9]/;
const INJECTION_PATTERNS = [
  // Instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/gi,
  /forget\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/gi,
  /override\s+(all\s+)?(previous|prior|earlier)?\s*instructions?/gi,
  /you\s+are\s+now/gi,
  /your\s+new\s+(role|task|instructions?)/gi,
  /act\s+as\s+(if\s+)?you\s+are/gi,

  // Prompt extraction attempts
  /(repeat|echo|show|display|print|output)\s+(all\s+)?(your\s+)?(instructions?|prompt|system\s+message)/gi,
  /what\s+are\s+(your\s+)?(\w+\s+)*(instructions?|prompt|system\s+message)/gi,
  /tell\s+me\s+(your\s+)?(\w+\s+)*(instructions?|prompt|system\s+message)/gi,

  // Output override attempts (trying to tell model what to return/set)
  // More specific pattern to avoid false positives with legitimate tasks
  // Requires injection-related keywords (task, category, priority, output, result) after the verb
  // Also captures common injection payloads that follow (e.g., "with category='...'", "and priority...")
  /instead\s*,\s*(return|set|make|assign)\s+(a\s+)?(task|category|priority|output|result)(\s+with\s+[^.]*)?(\s+and\s+[^.]*)?/gi,
  /instead\s+(return|set|make|assign)\s+(a\s+)?(task|category|priority|output|result)(\s+with\s+[^.]*)?(\s+and\s+[^.]*)?/gi,

  // Format manipulation attempts
  /##\s*instructions?/gi,
  /```\s*(instructions?|prompt|system)[^`]*```/gi,
];

export const sanitizeInput = (input: string, requestId: string) => {
  let sanitized = input.trim();
  const originalLength = sanitized.length;
  let patternsDetected = 0;

  for (const pattern of INJECTION_PATTERNS) {
    const beforeReplace = sanitized;

    sanitized = sanitized.replace(pattern, "").trim();

    if (sanitized !== beforeReplace) {
      patternsDetected++;
    }
  }

  sanitized = sanitized.replace(WHITESPACE_NORMALIZATION_PATTERN, " ").trim();

  const hasMeaningfulContent = MEANINGFUL_CONTENT_PATTERN.test(sanitized);

  if ((sanitized.length === 0 || !hasMeaningfulContent) && originalLength > 0) {
    logger.error("Input rejected: entirely composed of injection patterns", {
      requestId,
      originalLength,
      patternsDetected,
    });

    throw new BadRequestError(
      "Invalid input: Input appears to contain only malicious patterns and cannot be processed.",
      {
        type: AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED,
      }
    );
  }

  if (patternsDetected > 0) {
    logger.warn("Prompt injection pattern detected and removed", {
      requestId,
      patternsDetected,
      originalLength,
      sanitizedLength: sanitized.length,
    });
  }

  return sanitized;
};
