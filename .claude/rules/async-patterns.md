# Async Patterns

This file documents async/await patterns and best practices for this project.

## Fire-and-Forget Pattern

**Rule:** Always add error handlers to void promises, even for background operations.

### ❌ BAD - Silent Failures

```typescript
// Nested fire-and-forget without error handling
void reconcileTokens(...).then(() => {
  void cleanup(...);
});

// Error will be silently swallowed if reconciliation or cleanup fails
```

**Problem:** If either operation fails, errors are lost. No logging, no visibility.

### ✅ GOOD - Explicit Error Handling

```typescript
void reconcileTokens(redis, redlock, requestId, tokens, lockTtl)
  .then(() => {
    void cleanup(redis, requestId).catch((err) => {
      logger.error("Metadata cleanup failed", err, { requestId });
    });
  })
  .catch((err) => {
    logger.error("Token reconciliation failed", err, { requestId });
  });
```

**Why:** Background operations should log errors even if they don't block the main flow.

---

## Promise Error Handling

**Rule:** Every async operation must have an error handler.

### In Controllers

```typescript
try {
  await someAsyncOperation();
  res.status(200).json({ success: true });
} catch (error) {
  next(error); // Let error handler middleware deal with it
}
```

### In Services

```typescript
export const processTask = async (taskId: string): Promise<Result> => {
  try {
    const result = await externalApi.call(taskId);
    return result;
  } catch (error) {
    logger.error("External API call failed", error, { taskId });
    throw new InternalError("Failed to process task", { taskId });
  }
};
```

### In Background Operations

```typescript
// Fire-and-forget with error logging
void recordMetrics(startTime, operation)
  .catch((err) => {
    logger.error("Metrics recording failed", err, { operation });
    // Don't throw - metrics are non-critical
  });
```

---

## When to Use Fire-and-Forget

**Use for:**
- ✅ Metrics recording (Prometheus counters/histograms)
- ✅ Background cleanup (metadata expiration)
- ✅ Non-critical logging
- ✅ Cache invalidation

**Never use for:**
- ❌ Database writes that affect user state
- ❌ Operations that must complete before response
- ❌ Critical error handling
- ❌ Authentication/authorization checks

---

## Async Function Return Types

**Rule:** Always specify Promise return types explicitly.

### ❌ BAD - Implicit Return Type

```typescript
export const createTask = async (data: TaskInput) => {
  return await prisma.task.create({ data });
};
```

### ✅ GOOD - Explicit Return Type

```typescript
export const createTask = async (data: TaskInput): Promise<Task> => {
  return await prisma.task.create({ data });
};
```

**Why:** Makes contract clear, catches type errors early, helps with intellisense.

---

## Promise Chaining

**Rule:** Prefer async/await over .then() chains for readability.

### ❌ BAD - Complex .then() Chain

```typescript
return fetchData()
  .then((data) => processData(data))
  .then((processed) => saveData(processed))
  .catch((err) => handleError(err));
```

### ✅ GOOD - Async/Await

```typescript
try {
  const data = await fetchData();
  const processed = await processData(data);
  return await saveData(processed);
} catch (err) {
  handleError(err);
}
```

**Exception:** Fire-and-forget operations where .catch() is cleaner:

```typescript
void operation().catch((err) => logger.error("Failed", err));
```

---

## Error Context in Async Operations

**Rule:** Always include requestId and operation context in error logs.

```typescript
try {
  await riskyOperation(taskId);
} catch (error) {
  logger.error("Operation failed", error, {
    operation: "riskyOperation",
    taskId,
    requestId,
  });
  throw new InternalError("Operation failed", { taskId });
}
```

**Standard context fields:**
- `operation`: Function/method name
- `requestId`: Request tracking ID
- Entity IDs: `taskId`, `userId`, etc.

---

## Concurrent Operations

**Rule:** Use Promise.all() for independent operations, sequential for dependent ones.

### Parallel (Independent Operations)

```typescript
const [user, tasks, stats] = await Promise.all([
  fetchUser(userId),
  fetchTasks(userId),
  fetchStats(userId),
]);
```

### Sequential (Dependent Operations)

```typescript
const user = await fetchUser(userId);
const tasks = await fetchTasks(user.accountId); // Depends on user.accountId
const enriched = await enrichTasks(tasks); // Depends on tasks
```

---

## Testing Async Operations

**Rule:** Use `waitForBackgroundTasks()` helper for fire-and-forget testing.

```typescript
import { waitForBackgroundTasks } from "@shared/test-utils";

it("should reconcile tokens in background", async () => {
  // Act - triggers void reconcileTokenUsage(...)
  const response = await request(app).post("/endpoint").send(payload);

  // Wait for background promises to settle
  await waitForBackgroundTasks();

  // Assert - now safe to verify background operations
  expect(mockReconcileTokenUsage).toHaveBeenCalled();
});
```

**Pattern:** Act → `waitForBackgroundTasks()` → Assert

---

## Common Pitfalls

### 1. Floating Promises (ESLint Warning)

```typescript
// ❌ BAD - Floating promise
async function handler() {
  someAsyncOperation(); // ESLint: @typescript-eslint/no-floating-promises
}

// ✅ GOOD - Explicit void or await
async function handler() {
  void someAsyncOperation().catch(handleError);
  // OR
  await someAsyncOperation();
}
```

### 2. Missing Await in Try-Catch

```typescript
// ❌ BAD - Error won't be caught
try {
  operation(); // Missing await!
} catch (err) {
  // Never triggered
}

// ✅ GOOD
try {
  await operation();
} catch (err) {
  // Properly catches errors
}
```

### 3. Race Conditions in Async Code

```typescript
// ❌ BAD - Race condition
let state = await getState();
state = await updateState(state); // Another request might have modified state

// ✅ GOOD - Use distributed lock
await withLock(redlock, lockKey, async () => {
  const state = await getState();
  await updateState(state);
});
```

---

## Summary

- ✅ Always handle errors in async operations (even background ones)
- ✅ Use explicit Promise return types
- ✅ Prefer async/await over .then() chains
- ✅ Include requestId and context in error logs
- ✅ Use `void` keyword for intentional fire-and-forget
- ✅ Test fire-and-forget with `waitForBackgroundTasks()`
- ❌ Never let promises fail silently
- ❌ Never use fire-and-forget for critical operations
