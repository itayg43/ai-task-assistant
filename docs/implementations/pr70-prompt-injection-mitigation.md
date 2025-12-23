# Prompt Injection Detection & Blocking Implementation

## Overview

This document summarizes the implementation of **Prompt Injection Detection & Blocking** for AI capabilities. This feature blocks requests containing malicious patterns to prevent prompt injection attacks and jailbreaking attempts.

## Implementation Approach

**Detection & Blocking Strategy:**

- Pattern-based detection using regex for known injection patterns
- Zero-tolerance: Any detected pattern results in immediate request blocking
- No sanitization or processing of potentially malicious input
- Comprehensive logging and metrics for security monitoring

**Pattern Categories:**

1. Instruction override attempts (e.g., "ignore previous instructions")
2. Prompt extraction attempts (e.g., "what are your instructions")
3. Output override attempts (e.g., "instead, return...")
4. Format manipulation attempts (e.g., markdown/code block instructions)

## Changes

### Part 1: Metrics Infrastructure

- Created `prompt-injection-metrics.ts` with:
  - `promptInjectionBlockedTotal` counter with `pattern_type` label
  - `recordPromptInjectionBlocked(patternType)` helper function
  - Tracks four pattern types: `instruction_override`, `prompt_extraction`, `output_override`, `format_manipulation`

### Part 2: Detection Logic

- Pattern organization: Grouped patterns by type (INSTRUCTION_OVERRIDE_PATTERNS, PROMPT_EXTRACTION_PATTERNS, OUTPUT_OVERRIDE_PATTERNS, FORMAT_MANIPULATION_PATTERNS)
- Pattern optimization: Regex patterns use case-insensitive `/i` flag instead of global `/g`
- Detects ANY pattern match → immediately throws `BadRequestError`
- Records metric with detected pattern type
- Logs full input for security analysis
- Returns trimmed input only if no patterns detected

### Part 3: Automated Middleware Integration

- Created `validate-prompt-injection` middleware
- Middleware reads required `promptInjectionFields` from capability config
- Automatically validates specified fields using dot notation paths (e.g., "body.naturalLanguage")
- Integrated into router middleware chain after input validation
- Future capabilities must declare `promptInjectionFields` (use `[]` if no user input)
- Making field required ensures developers explicitly consider injection detection for every capability
- If a capability has no user input to validate, developers must explicitly use empty array `[]`, which documents the intentional decision

### Part 4: Error Response Sanitization (PR #75)

**Security Enhancement: Information Hiding**

To prevent attackers from learning about detection mechanisms, error responses are sanitized before reaching the client:

**AI Service Response** (Internal):

- Returns generic message: "Invalid input provided."
- Includes `type: "PROMPT_INJECTION_DETECTED"` in error context
- Logs full input details for security analysis

**Tasks Service Response** (Client-facing):

- Detects `AI_ERROR_TYPE.PROMPT_INJECTION_DETECTED` error type from AI service
- Strips sensitive context (type, aiServiceRequestId) before forwarding
- Returns only: `{ "message": "Invalid input provided.", "tasksServiceRequestId": "..." }`
- Logs sanitization event for audit trail

**Implementation Details**:

- Error type constants organized in `AI_ERROR_TYPE` object for consistency with AI service patterns
- Error sanitization in `ai-capabilities-service.ts` at service boundary
- Type-safe detection using object constants
- Defense-in-depth: Multiple layers ensure no information leakage
- Internal observability preserved through comprehensive logging

**Test Coverage**:

- Integration tests verify generic messages don't contain injection patterns
- Tests confirm no `type` or `aiServiceRequestId` fields in client responses
- Both AI and Tasks service layers validated
