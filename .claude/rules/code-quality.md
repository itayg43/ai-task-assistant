# Code Quality Standards

This file documents code quality standards and best practices for maintaining clean, type-safe, and maintainable code.

## Type Safety

### Rule: Avoid `any` Type

**Never use `any` without explicit justification and a comment explaining why.**

#### ❌ BAD - Untyped Generic

```typescript
const response = await openai.responses.parse<any, TOutput>(prompt);
```

#### ✅ GOOD - Proper Typing

```typescript
const response = await openai.responses.parse<
  ResponseCreateParamsNonStreaming,
  TOutput
>(prompt);
```

#### ❌ BAD - Untyped Helper Function

```typescript
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};
```

#### ✅ GOOD - Typed with Index Signature

```typescript
const getNestedValue = (
  obj: Record<string, unknown>,
  path: string
): unknown => {
  return path.split(".").reduce((current: any, key: string) => current?.[key], obj);
};
```

**When `any` is acceptable (rare):**
- Third-party library with no types available (add `// @ts-expect-error` comment)
- Dynamic JSON parsing where structure is validated at runtime with Zod
- Always add comment: `// any: reason for using any`

---

## Non-Null Assertions

### Rule: Never Use `!` Without Validation

Non-null assertions (`!`) silence the type checker but don't prevent runtime errors.

#### ❌ BAD - Unchecked Assertion

```typescript
const taskWithSubtasks = await findTaskById(tx, createdTask.id, userId);
return taskWithSubtasks!; // What if null?
```

#### ✅ GOOD - Explicit Validation

```typescript
const taskWithSubtasks = await findTaskById(tx, createdTask.id, userId);
if (!taskWithSubtasks) {
  throw new InternalError("Task not found after creation", {
    taskId: createdTask.id,
  });
}
return taskWithSubtasks;
```

**Why:** Race conditions, database constraints, or logic errors can cause unexpected nulls.

---

## DRY (Don't Repeat Yourself)

### Rule: Extract Code Duplicated 3+ Times

#### When to Extract

**Extract to function if:**
- Same logic appears 3+ times
- Parameters and pattern are identical
- Changes would need to be made in multiple places

**Keep separate if:**
- Logic is similar but context differs significantly
- Extraction would make code harder to understand
- Each instance might diverge in the future

#### ❌ BAD - Duplicated Pattern (5 times)

```typescript
// File 1
void reconcileTokensIfPossible(redis, redlock, requestId, tokens, lockTtl);

// File 2 (4 more times)
void reconcileTokensIfPossible(redis, redlock, requestId, tokens, lockTtl);
```

#### ✅ GOOD - Extracted Service Method

```typescript
// token-reconciliation-service.ts
export const scheduleTokenReconciliation = (
  redis: RedisClient,
  redlock: RedlockClient,
  requestId: string,
  tokens: number,
  lockTtl: number
) => {
  void reconcileTokensIfPossible(redis, redlock, requestId, tokens, lockTtl)
    .catch((err) => {
      logger.error("Token reconciliation failed", err, { requestId });
    });
};

// Usage (5 places)
scheduleTokenReconciliation(redis, redlock, requestId, tokens, lockTtl);
```

**Benefits:**
- Single place to add error handling
- Consistent behavior across all call sites
- Easy to modify retry logic, logging, etc.

---

## Magic Numbers and Strings

### Rule: Use Named Constants for Semantic Values

#### ❌ BAD - Magic Numbers

```typescript
buckets: [500, 1000, 2500, 3000, 4000, 5000, 7500, 10000, 15000];
```

#### ✅ GOOD - Named Constants

```typescript
const METRICS_BUCKETS = {
  FAST_QUERY_MS: 500,          // Fast DB queries (GET tasks)
  NORMAL_QUERY_MS: 1000,       // Typical DB operations
  AI_CALL_MIN_MS: 2500,        // Minimum AI service response time
  AI_CALL_TYPICAL_MS: 3000,    // Typical AI service response time
  AI_CALL_COMPLEX_MS: 4000,    // Complex AI operations
  AI_CALL_MAX_MS: 5000,        // Maximum expected AI response
  AI_CALL_SLOW_MS: 7500,       // Slow AI responses (alert threshold)
  AI_CALL_TIMEOUT_MS: 10000,   // Near timeout threshold
  AI_CALL_CRITICAL_MS: 15000,  // Critical slow responses
} as const;

// Usage
buckets: Object.values(METRICS_BUCKETS);
```

**When to use constants:**
- ✅ Timeouts, delays, intervals
- ✅ HTTP status codes (or use `StatusCodes` from http-status-codes)
- ✅ Retry counts, rate limits
- ✅ Port numbers, API versions
- ❌ Don't over-abstract: `const ONE = 1` is silly

---

## Function Complexity

### Rule: Keep Functions Focused and Under 50 Lines

**Signs a function is too complex:**
- More than 3 levels of nesting
- Multiple responsibilities
- Hard to name clearly
- More than 5 parameters

#### ❌ BAD - Complex Function

```typescript
export const processWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { success, data, error } = req.body;
    if (success) {
      const task = await prisma.task.create({
        data: {
          title: data.title,
          // ... 20 more lines
        },
      });
      void reconcileTokens(...);
      void recordMetrics(...);
      res.json({ task });
    } else {
      if (error.type === "VAGUE_INPUT") {
        void reconcileTokens(...);
      }
      void recordMetrics(...);
      res.status(500).json({ error });
    }
  } catch (err) {
    next(err);
  }
};
```

#### ✅ GOOD - Extracted Logic

```typescript
export const processWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { success, data, error } = req.body;

    if (success) {
      await handleSuccessWebhook(data, res);
    } else {
      await handleErrorWebhook(error, res);
    }
  } catch (err) {
    next(err);
  }
};

// Extracted helpers
const handleSuccessWebhook = async (data: WebhookData, res: Response) => {
  const task = await createTaskFromWebhook(data);
  scheduleBackgroundOperations(data.requestId, data.tokens);
  res.json({ task });
};

const handleErrorWebhook = async (error: WebhookError, res: Response) => {
  if (shouldReconcileTokens(error)) {
    scheduleTokenReconciliation(error.requestId, error.tokens);
  }
  recordErrorMetrics(error);
  res.status(500).json({ error });
};
```

---

## Naming Conventions

### Rule: Use Clear, Descriptive Names

**Conventions:**
- `PascalCase`: Types, interfaces, classes (`Task`, `WebhookController`)
- `camelCase`: Variables, functions, methods (`createTask`, `requestId`)
- `UPPER_SNAKE_CASE`: Constants (`MAX_RETRIES`, `DEFAULT_TIMEOUT_MS`)
- Prefix booleans: `is`, `has`, `should` (`isValid`, `hasPermission`)
- Prefix async: Optional but helpful (`fetchUser` vs `getUser`)

#### ❌ BAD - Unclear Names

```typescript
const data = await get(id);
const x = process(data);
const flag = check(x);
```

#### ✅ GOOD - Descriptive Names

```typescript
const task = await findTaskById(taskId);
const parsedTask = await parseTaskWithAI(task.naturalLanguage);
const isValidPriority = validatePriorityScore(parsedTask.priorityScore);
```

---

## Code Comments

### Rule: Code Should Be Self-Documenting, Comments Explain "Why"

#### ❌ BAD - Obvious Comment

```typescript
// Get user by ID
const user = await getUserById(userId);
```

#### ❌ BAD - Commented-Out Code

```typescript
// const oldImplementation = await legacyMethod();
const result = await newMethod();
```

**Delete it!** Use git history if you need to reference old code.

#### ✅ GOOD - Explains "Why"

```typescript
// Use distributed lock to prevent race condition between reading state and incrementing tokens
await withLock(redlock, lockKey, async () => {
  const bucket = await getTokenBucket(redis, bucketKey);
  await processTokenBucket(redis, bucket, bucketKey);
});
```

#### ✅ GOOD - Documents Edge Cases

```typescript
// TODO: Add metric to track metadata expiration (tokens will leak in this edge case)
if (!metadata) {
  logger.warn("Metadata not found - likely expired after 1h TTL", { requestId });
  return;
}
```

**Use comments for:**
- ✅ Explaining non-obvious decisions
- ✅ Documenting edge cases or workarounds
- ✅ TODO/FIXME with context
- ✅ Performance-critical sections
- ❌ Describing what code does (code should be self-explanatory)

---

## Imports Organization

### Rule: Group Imports by Type

**Order:**
1. External dependencies (npm packages)
2. Shared internal modules (`@shared/*`)
3. Service-level modules (`@config`, `@services`, etc.)
4. Relative imports (`./`, `../`)

```typescript
// 1. External dependencies
import express from "express";
import { z } from "zod";

// 2. Shared modules
import { createLogger } from "@shared/config/create-logger";
import { withRetry } from "@shared/utils/with-retry";

// 3. Service-level modules
import { env } from "@config/env";
import { createTaskHandler } from "@services/tasks-service";

// 4. Relative imports
import { validateTaskInput } from "./validators";
import type { TaskControllerInput } from "./types";
```

---

## Error Handling

### Rule: Use Typed Errors, Include Context

See `.claude/rules/error-handling.md` for full details.

**Quick reference:**
- ✅ Throw: `BadRequestError`, `InternalError`, `NotFoundError`
- ❌ Never: Generic `Error` or `throw new Error()`
- ✅ Include: `requestId`, operation context, entity IDs
- ✅ Log before throwing in service layer

---

## File Organization

### Rule: Colocate Related Files

**Structure:**
```
src/
  controllers/
    tasks-controller/
      tasks-controller.ts
      tasks-controller.test.ts          # Unit tests
      tasks-controller.integration.test.ts  # Integration tests
      index.ts
```

**Benefits:**
- Easy to find tests for a file
- Clear what's tested vs not tested
- Delete controller → delete entire folder

---

## Summary Checklist

Before committing code, verify:

- [ ] No `any` types without justification
- [ ] No non-null assertions (`!`) without validation
- [ ] No code duplication (DRY violations)
- [ ] Named constants for magic numbers
- [ ] Functions under 50 lines, single responsibility
- [ ] Clear, descriptive variable/function names
- [ ] Comments explain "why", not "what"
- [ ] Imports organized by type
- [ ] Type-check passes: `npm run type-check:ci`
- [ ] Tests pass: `npm test -- --run`
