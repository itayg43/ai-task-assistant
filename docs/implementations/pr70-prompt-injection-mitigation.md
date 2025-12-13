# Prompt Injection Mitigation Implementation

## Overview

This document summarizes the implementation of **Prompt Injection Mitigation** for the parse-task capability. This feature adds essential security protections to prevent malicious user input from overriding system instructions or extracting sensitive prompt information.

## Implementation Plan

The implementation focuses on input sanitization as the primary defense against prompt injection attacks.

**Note**: Initial implementation included prompt hardening (security instructions in prompts), but testing revealed it was unnecessary. The OpenAI Responses API structure (separate `instructions` and `input` fields) provides sufficient protection, and input sanitization removes malicious patterns before they reach the model. Prompt hardening was removed to reduce token usage.

## Input Sanitization

### Part 1.1: Create Sanitization Utility

**File**: `backend/services/ai/src/utils/prompt-injection-sanitizer/prompt-injection-sanitizer.ts`

**Changes**:

- Created new utility directory following the pattern of other utils (e.g., `get-capability-config/`)
- Created `prompt-injection-sanitizer.ts` with `sanitizeInput` function
- Created `index.ts` for clean exports (allows importing from `@utils/prompt-injection-sanitizer`)
- Extracted regex patterns into constants at the top:
  - `WHITESPACE_NORMALIZATION_PATTERN` - for normalizing whitespace
  - `MEANINGFUL_CONTENT_PATTERN` - for checking meaningful content
- Implemented pattern detection using regex for common injection attempts:
  - Instruction override attempts (e.g., "ignore previous instructions")
  - Prompt extraction attempts (e.g., "repeat all your instructions", "what are your exact instructions")
  - Output override attempts (e.g., "instead, return...", "instead, set...")
  - Format manipulation attempts (e.g., markdown/code block instructions)
- Pattern improvements:
  - Fixed "what are your instructions" pattern to handle optional words between "your" and "instructions" (e.g., "exact", "full", "complete")
  - Added specific patterns for "instead" override attempts that require injection-related keywords (task, category, priority, output, result) to avoid false positives
  - Enhanced "instead" patterns to capture full injection payloads (e.g., "with category='...'", "and priority...")
  - Note: Legitimate task descriptions like "Instead, return the item to the store" are preserved (only malicious injection attempts are blocked)
- Removes detected patterns from input while preserving legitimate content
- Normalizes whitespace after pattern removal
- Rejects input entirely composed of injection patterns (throws `BadRequestError`)
- Logs injection attempts for monitoring:
  - Error log when input is entirely malicious
  - Warning log when patterns detected but valid content remains
- Added new error type `PROMPT_INJECTION_DETECTED` to `AI_ERROR_TYPE` constants

**Key Features**:

- **Pattern Removal**: Removes detected injection patterns while preserving legitimate task descriptions
- **Early Rejection**: Rejects entirely malicious input before API calls (saves tokens/cost)
- **Logging**: Tracks injection attempts for monitoring and security analysis
- **API Structure Protection**: The OpenAI Responses API structure (separate `instructions` and `input` fields) provides additional protection by clearly separating system instructions from user input

**Rationale**:

- Provides first line of defense before API calls
- Saves tokens and cost by rejecting malicious input early
- Enables security monitoring through logging
- Works with API structure to provide comprehensive protection

### Part 1.2: Integrate Sanitization in Handler

**File**: `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.ts`

**Changes**:

- Added import for `sanitizeInput` from `@utils/prompt-injection-sanitizer`
- Integrated sanitization at the beginning of `parseTaskHandler` function
- Sanitization occurs immediately after extracting `naturalLanguage` from input body
- Sanitized input is used for both `coreHandler` and `subtasksHandler` calls
- If input is entirely malicious, `sanitizeInput` throws `BadRequestError` before any API calls

**Integration Flow**:

1. Extract `naturalLanguage` from input body
2. **Sanitize input** (removes injection patterns, rejects entirely malicious input)
3. Pass sanitized input to core handler
4. Pass sanitized input to subtasks handler

**Error Handling**:

- If input is entirely composed of injection patterns, `BadRequestError` is thrown with type `PROMPT_INJECTION_DETECTED`
- Error is caught by existing error handling middleware and returned as 400 response
- No API calls are made for entirely malicious input (saves tokens/cost)

**Rationale**:

- Early sanitization prevents malicious input from reaching OpenAI API
- Single point of sanitization ensures consistent protection across all handlers
- Error handling integrates seamlessly with existing middleware
- API structure (separate `instructions` and `input` fields) provides additional protection

## Testing

### Part 2.1: Unit Tests for Sanitization

**File**: `backend/services/ai/src/utils/prompt-injection-sanitizer/prompt-injection-sanitizer.test.ts`

**Changes**:

- Created comprehensive unit test suite for `sanitizeInput` function
- Test coverage includes:
  - **Instruction override attempts**: Tests for "ignore previous instructions", "forget instructions", "disregard instructions", "override instructions", "you are now", "your new role", "act as if you are"
  - **Prompt extraction attempts**: Tests for "repeat all your instructions", "what are your instructions", "what are your exact instructions", "tell me your instructions", "show your prompt"
  - **Output override attempts**: Tests for "instead, return a task", "instead return a task", "instead, set category", "instead, make priority", and full payload removal
  - **Legitimate "instead" usage**: Tests to ensure legitimate tasks like "Instead, return the item to the store" are preserved
  - **Format manipulation attempts**: Tests for markdown headers and code block instructions
  - **Legitimate task descriptions**: Tests to ensure legitimate inputs are preserved unchanged
  - **Multiple patterns**: Tests for inputs with multiple injection patterns
  - **Whitespace normalization**: Tests for proper whitespace handling
  - **Entirely malicious input**: Tests for rejection of input composed entirely of injection patterns
  - **Edge cases**: Tests for empty strings, whitespace-only, patterns at different positions

**Key Test Scenarios**:

- Pattern removal while preserving legitimate content
- Rejection of entirely malicious input with correct error type
- Whitespace normalization after pattern removal
- Case-insensitive pattern matching
- Multiple pattern detection and removal

**Rationale**:

- Ensures sanitization function works correctly for all known injection patterns
- Validates that legitimate inputs are not affected
- Confirms proper error handling for malicious input
- Provides regression protection for future changes

### Part 2.2: Integration Tests

**File**: `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.test.ts`

**Changes**:

- Added integration test suite for prompt injection handling in `parseTaskHandler`
- Uses `beforeEach` to set v2 prompt version (which has input validation)
- Uses `it.each` to reduce duplication across similar test cases
- Test coverage includes:
  - **Entirely malicious input**: Verifies `BadRequestError` is thrown with `PROMPT_INJECTION_DETECTED` type and no API calls are made
  - **Instruction override attempts**: Verifies patterns are removed, sanitized input is passed to handlers, and results in vague input error (matching real behavior)
  - **Prompt extraction attempts**: Verifies extraction patterns are removed and results in vague input error (matching real behavior)
  - **Output override attempts**: Verifies override patterns are removed and results in vague input error (matching real behavior)

**Key Test Scenarios**:

- Sanitization prevents API calls for entirely malicious input
- Sanitized input is passed to handlers (not original malicious input)
- After sanitization, remaining input is often vague and gets rejected by v2 prompt validation
- Tests reflect real behavior where injection attempts result in vague input errors, not successful parsing
- Integration with existing handler logic

**Rationale**:

- Validates end-to-end flow with injection attempts
- Ensures sanitization doesn't break legitimate task parsing
- Confirms protection approach works (sanitization + API structure + output validation)
- Provides confidence that the system handles injection attempts correctly
