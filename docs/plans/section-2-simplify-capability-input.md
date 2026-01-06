# Section 2: Simplify Capability Input Structure

## Overview

This plan simplifies capability inputs to pass only the required data directly instead of the full Express request structure (`body`, `params`, `query`). For example, `parse-task` will receive `{ naturalLanguage, config }` instead of `{ body: { naturalLanguage, config }, params: { capability }, query: { pattern } }`.

## Context

- Section 1 (Error Extraction Refactoring) has been completed
- All tests pass and type-check passes
- The error extraction utility is now reusable

## Implementation Steps

### 1. Update Input Schemas

**File:** `backend/services/ai/src/capabilities/parse-task/parse-task-schemas.ts`

- Change `parseTaskInputSchema` from:
  ```typescript
  export const parseTaskInputSchema = executeCapabilityInputSchema.extend({
    body: z.object({
      naturalLanguage: z.string().trim().nonempty().max(255),
      config: parseTaskInputConfigSchema,
    }),
  });
  ```
  
  To:
  ```typescript
  export const parseTaskInputSchema = z.object({
    naturalLanguage: z.string().trim().nonempty().max(255),
    config: parseTaskInputConfigSchema,
  });
  ```

- Remove the `executeCapabilityInputSchema.extend()` wrapper
- Keep `executeCapabilityInputSchema` for route validation (it's used by `validate-executable-capability` middleware)

### 2. Update Capability Handler

**File:** `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.ts`

- Change handler signature from:
  ```typescript
  export const parseTaskHandler = async (
    input: ParseTaskInput,
    requestId: string
  ): Promise<...> => {
    const { naturalLanguage, config } = input.body;
  ```
  
  To:
  ```typescript
  export const parseTaskHandler = async (
    input: ParseTaskInput,
    requestId: string
  ): Promise<...> => {
    const { naturalLanguage, config } = input;
  ```

- Remove `input.body` destructuring (line 130), use `input` directly
- The `ParseTaskInput` type will automatically update via `z.infer<typeof parseTaskInputSchema>`

### 3. Update Type Definitions

**File:** `backend/services/ai/src/capabilities/parse-task/parse-task-types.ts`

- `ParseTaskInput` type is inferred from `parseTaskInputSchema`, so it will automatically update
- Verify the type is now `{ naturalLanguage: string, config: ParseTaskInputConfig }` instead of the nested structure
- No manual changes needed unless there are explicit type definitions

### 4. Update Validation Middleware

**File:** `backend/services/ai/src/middlewares/validate-capability-input/validate-capability-input.ts`

- Change from:
  ```typescript
  const validatedInput = config.inputSchema.parse(req);
  ```
  
  To:
  ```typescript
  const validatedInput = config.inputSchema.parse(req.body);
  ```

- The capability's `inputSchema` now validates only the request body content
- Store the validated body content directly in `res.locals.capabilityValidatedInput`
- Note: Route params (`params.capability`, `query.pattern`) are already validated by `validate-executable-capability` middleware

### 5. Update Controller and Executor

**File:** `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`

- The `validatedInput` from `getCapabilityValidatedInput` will now be the simplified structure
- Pass it directly to the pattern executor (no extraction needed)
- Remove any code that extracts from `validatedInput.body`

**File:** `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/execute-sync-pattern.ts`

- Verify it receives and passes the simplified input correctly
- The handler should receive `{ naturalLanguage, config }` directly

### 6. Update Prompt Injection Validation

**File:** `backend/services/ai/src/capabilities/index.ts`

- Change `promptInjectionFields` from:
  ```typescript
  promptInjectionFields: ["body.naturalLanguage"]
  ```
  
  To:
  ```typescript
  promptInjectionFields: ["naturalLanguage"]
  ```

**File:** `backend/services/ai/src/middlewares/validate-prompt-injection/validate-prompt-injection.ts`

- The field path resolution should work with the simplified structure (no `body.` prefix needed)
- Verify the field path resolution logic handles the new structure correctly

### 7. Update Tasks Service

**File:** `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts`

- Verify the `params` field in `TExecuteCapabilityConfig` already matches the simplified structure (`{ naturalLanguage, config }`)
- The HTTP request body sent to the AI service should match the new structure (no `body` wrapper)
- The request should be: `POST /capabilities/parse-task?pattern=sync` with body `{ naturalLanguage, config }`

### 8. Update Mocks

**File:** `backend/services/ai/src/capabilities/parse-task/parse-task-mocks.ts`

- Change `mockParseTaskValidatedInput` from:
  ```typescript
  export const mockParseTaskValidatedInput: ParseTaskInput = {
    params: {
      capability: CAPABILITY.PARSE_TASK,
    },
    query: {
      pattern: CAPABILITY_PATTERN.SYNC,
    },
    body: {
      naturalLanguage: mockNaturalLanguage,
      config: mockParseTaskInputConfig,
    },
  };
  ```
  
  To:
  ```typescript
  export const mockParseTaskValidatedInput: ParseTaskInput = {
    naturalLanguage: mockNaturalLanguage,
    config: mockParseTaskInputConfig,
  };
  ```

- Update `mockParseTaskCapabilityConfig.promptInjectionFields` from `["body.naturalLanguage"]` to `["naturalLanguage"]`

### 9. Update All Test Files

#### Capability Input Tests

**File:** `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.unit.test.ts`
- Update to use simplified input structure
- Remove references to `validatedInput.body`, `validatedInput.params`, `validatedInput.query`
- Use `validatedInput` directly

**File:** `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.integration.test.ts`
- Update handler call expectations (around line 70-82)
- Change from:
  ```typescript
  expect(mockedParseTaskHandler).toHaveBeenCalledWith(
    {
      body: { naturalLanguage: ..., config: ... },
      params: { capability: ... },
      query: { pattern: ... },
    },
    requestId
  );
  ```
  
  To:
  ```typescript
  expect(mockedParseTaskHandler).toHaveBeenCalledWith(
    {
      naturalLanguage: ...,
      config: ...,
    },
    requestId
  );
  ```

**File:** `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/execute-sync-pattern.test.ts`
- Update mock input structure to use simplified format
- Change `mockInput` to match new structure

**File:** `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.test.ts`
- Update handler calls (around line 84-91)
- Change from:
  ```typescript
  await parseTaskHandler(
    {
      ...mockParseTaskValidatedInput,
      body: { ...mockParseTaskValidatedInput.body, ... },
    },
    requestId
  );
  ```
  
  To:
  ```typescript
  await parseTaskHandler(
    {
      ...mockParseTaskValidatedInput,
      naturalLanguage: ...,
    },
    requestId
  );
  ```

**File:** `backend/services/ai/src/middlewares/validate-capability-input/validate-capability-input.test.ts`
- Update expected validated input structure
- Change from expecting `{ body: {...}, params: {...}, query: {...} }` to `{ naturalLanguage: ..., config: ... }`

**File:** `backend/services/ai/src/middlewares/validate-prompt-injection/validate-prompt-injection.test.ts`
- Update field paths from `"body.naturalLanguage"` to `"naturalLanguage"` (around lines 76, 86-91, 100-105, 131-136)
- Update input structure in test mocks to use simplified format
- Change from:
  ```typescript
  capabilityValidatedInput: {
    ...mockParseTaskValidatedInput,
    body: { ...mockParseTaskValidatedInput.body, naturalLanguage: "..." },
  }
  ```
  
  To:
  ```typescript
  capabilityValidatedInput: {
    ...mockParseTaskValidatedInput,
    naturalLanguage: "...",
  }
  ```

**File:** `backend/services/ai/src/capabilities/parse-task/parse-task-mocks.ts`
- Already covered in step 8 above

**File:** `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.test.ts`
- Verify HTTP request body structure matches new format
- Ensure tests expect body to be `{ naturalLanguage, config }` not `{ body: { naturalLanguage, config } }`

#### Other Potentially Affected Tests

**File:** `backend/services/ai/src/utils/get-capability-validated-input/get-capability-validated-input.test.ts`
- May need updates if it tests the structure
- Verify it returns the simplified structure

**File:** `backend/services/ai/src/utils/get-capability-config/get-capability-config.test.ts`
- Verify no changes needed

**File:** `backend/services/ai/src/controllers/capabilities-controller/executors/get-pattern-executor/get-pattern-executor.test.ts`
- Verify no changes needed

## Validation Flow

The validation flow should work as follows:

1. `validate-executable-capability` middleware validates route params (`params.capability`, `query.pattern`) using `executeCapabilityInputSchema.parse(req)`
2. `validate-capability-input` middleware validates request body using `config.inputSchema.parse(req.body)` (simplified structure)
3. The capability handler receives only the validated body content (e.g., `{ naturalLanguage, config }`)

## Testing Commands

After completing all changes:

1. Run all tests:
   ```bash
   npm run test
   ```

2. Run type-check:
   ```bash
   npm run type-check:ci
   ```

3. If tests fail, fix them before proceeding
4. If type-check fails, fix type errors before proceeding

## Expected Changes Summary

### Before:
```typescript
// Handler receives:
{
  body: { naturalLanguage: "...", config: {...} },
  params: { capability: "parse-task" },
  query: { pattern: "sync" }
}

// Handler uses:
const { naturalLanguage, config } = input.body;
```

### After:
```typescript
// Handler receives:
{
  naturalLanguage: "...",
  config: {...}
}

// Handler uses:
const { naturalLanguage, config } = input;
```

## Files to Modify

1. `backend/services/ai/src/capabilities/parse-task/parse-task-schemas.ts`
2. `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.ts`
3. `backend/services/ai/src/capabilities/parse-task/parse-task-types.ts` (verify only)
4. `backend/services/ai/src/middlewares/validate-capability-input/validate-capability-input.ts`
5. `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`
6. `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/execute-sync-pattern.ts` (verify only)
7. `backend/services/ai/src/capabilities/index.ts`
8. `backend/services/ai/src/middlewares/validate-prompt-injection/validate-prompt-injection.ts` (verify only)
9. `backend/services/tasks/src/services/ai-capabilities-service/ai-capabilities-service.ts` (verify only)
10. `backend/services/ai/src/capabilities/parse-task/parse-task-mocks.ts`
11. All test files listed in step 9

## Notes

- The `executeCapabilityInputSchema` is still used for route-level validation (params and query)
- Only the capability-specific input schema is simplified
- All existing functionality must be preserved
- Tests should verify the new structure works correctly
- The HTTP request body structure changes, but the API contract remains the same (just the internal structure is simplified)

