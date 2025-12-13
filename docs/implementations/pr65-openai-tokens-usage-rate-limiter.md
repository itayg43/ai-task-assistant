# Token Usage Rate Limiter Implementation

## Overview

This document summarizes the implementation of the **Token Usage Rate Limiter** feature. This feature adds distributed rate limiting for OpenAI token usage, tracking actual token consumption during task creation and adjusting held tokens based on real usage. The system uses Redis for distributed state management and Redlock for distributed locking to ensure consistency across multiple service instances.

## Architecture Changes

### Core Concept

The token usage rate limiter implements a **fixed-window rate limiting** strategy that:

1. **Holds** estimated tokens before processing a request
2. **Tracks** actual token usage from OpenAI API responses
3. **Adjusts** the difference between held and actual tokens after processing
4. **Resets** the window periodically based on configured window size

### Key Components

1. **Token Usage Rate Limiter Middleware**: Pre-request middleware that holds tokens
2. **Token Usage Update Middleware**: Post-response middleware that adjusts actual usage
3. **Token Usage Error Handler**: Error middleware that handles token adjustment on failures
4. **Token Usage State Utilities**: Redis operations for managing token usage state
5. **Token Usage Processing**: Core logic for checking limits and holding tokens

## Implementation Details

### 1. Token Usage State Management

**File**: `backend/shared/src/utils/token-bucket/token-usage-state-utils/token-usage-state-utils.ts`

The system uses Redis hash fields to store token usage state:

- `tokensUsed`: Current number of tokens consumed in the window
- `windowStartTimestamp`: Timestamp marking the start of the current window

**Key Functions**:

- `getTokenUsageState(redisClient, key, defaultWindowStartTimestamp)`: Retrieves current token usage state
- `incrementTokenUsage(redisClient, key, amount)`: Atomically increments token usage using `incrementHashField` from Redis utilities
- `decrementTokenUsage(redisClient, key, amount)`: Atomically decrements token usage using `decrementHashField` from Redis utilities
- `resetTokenUsageWindow(redisClient, key, newWindowStartTimestamp, ttlSeconds)`: Resets window and sets TTL

**Redis Key Structure**:

```
token-bucket:{serviceName}:{rateLimiterName}:{userId}
```

**Redis Hash Fields**:

```typescript
{
  tokensUsed: string,              // Number as string
  windowStartTimestamp: string     // Timestamp as string
}
```

### 2. Token Usage Processing

**File**: `backend/shared/src/utils/token-bucket/process-token-usage/process-token-usage.ts`

**Function**: `processTokenUsage(redisClient, config, userId)`

**Process Flow**:

1. **Calculate Current Window**: Determines the current window start timestamp using fixed-window calculation:

   ```typescript
   const calculatedWindowStartTimestamp =
     Math.floor(now / windowSizeSecondsMs) * windowSizeSecondsMs;
   ```

2. **Get Current State**: Retrieves current token usage state from Redis

3. **Window Reset Check**: If the window has changed, resets the token usage:

   - Sets `tokensUsed` to 0
   - Updates `windowStartTimestamp` to new window start
   - Sets TTL on the Redis key

4. **Token Limit Check**: Verifies if estimated tokens can fit within the window limit:

   ```typescript
   if (tokensUsed + estimatedTokens > config.windowTokensLimit) {
     return { allowed: false, ... };
   }
   ```

5. **Hold Tokens**: Atomically increments token usage by estimated amount

6. **Return Result**: Returns `TokenUsageState` with hold details

**Return Type**:

```typescript
type TokenUsageState = {
  allowed: boolean;
  tokensUsed: number;
  tokensReserved: number;
  tokensRemaining: number;
  windowStartTimestamp: number;
};
```

### 3. Token Usage Update

**File**: `backend/shared/src/utils/token-bucket/update-token-usage/update-token-usage.ts`

**Function**: `updateTokenUsage(redisClient, serviceName, rateLimiterName, userId, actualTokens, reservedTokens, windowStartTimestamp)`

**Process Flow**:

1. **Get Current State**: Retrieves current token usage state

2. **Window Mismatch Check**: Warns if window changed during request processing (edge case)

3. **Calculate Difference**: Computes difference between held and actual tokens:

   ```typescript
   const diff = reservedTokens - actualTokens;
   ```

4. **Adjust Tokens**:
   - **diff === 0**: No adjustment needed (held matches actual)
   - **diff > 0**: Release excess tokens (held more than used)
   - **diff < 0**: Increment additional tokens (used more than held)

**Scenarios**:

- **Perfect Estimate**: Held tokens match actual usage → no change
- **Over-Estimated**: Held more than needed → decrement excess
- **Under-Estimated**: Used more than held → increment difference

### 4. Token Usage Rate Limiter Middleware

**File**: `backend/shared/src/middlewares/token-usage-rate-limiter/create-token-usage-rate-limiter/create-token-usage-rate-limiter.ts`

**Function**: `createTokenUsageRateLimiter(redisClient, redlockClient, config)`

**Middleware Flow**:

1. **Extract User Context**: Gets `userId` from authentication context

2. **Acquire Distributed Lock**: Uses Redlock to ensure atomic operations across instances

3. **Process Token Usage**: Calls `processTokenUsage` to check limits and hold tokens

4. **Handle Rate Limit**: If not allowed, throws `TooManyRequestsError` (429)

5. **Store Hold Data**: Stores hold data in `res.locals.tokenUsage`:

   ```typescript
   res.locals.tokenUsage = {
     tokensReserved: result.tokensReserved,
     windowStartTimestamp: result.windowStartTimestamp,
     // actualTokens will be set later
   };
   ```

6. **Error Handling**: Converts non-BaseError exceptions to `ServiceUnavailableError`

**Configuration Type**:

```typescript
type TokenUsageRateLimiterConfig = {
  serviceName: string;
  rateLimiterName: string;
  windowTokensLimit: number;
  windowSizeSeconds: number;
  estimatedTokens: number;
  lockTtlMs: number;
};
```

### 5. Token Usage Update Middleware

**File**: `backend/shared/src/middlewares/token-usage-rate-limiter/update-token-usage/update-token-usage.ts`

**Function**: `createUpdateTokenUsageMiddleware(redisClient, redlockClient, serviceName, rateLimiterName, lockTtlMs)`

**Middleware Flow**:

1. **Check Hold Data**: Only processes if `tokenUsage` exists and `actualTokens` is set

2. **Extract Data**: Gets hold data and actual token usage from `res.locals.tokenUsage`

3. **Async Update**: Uses `setImmediate` to update token usage asynchronously (non-blocking)

4. **Acquire Lock**: Uses Redlock for atomic update operation

5. **Update Usage**: Calls `updateTokenUsage` to adjust tokens

6. **Error Handling**: Logs errors but doesn't fail the request (best-effort adjustment)

**Design Decision**: Updates happen asynchronously using `setImmediate` to avoid blocking the HTTP response

### 6. Token Usage Error Handler

**File**: `backend/services/tasks/src/middlewares/token-usage-error-handler/token-usage-error-handler.ts`

**Function**: `tokenUsageErrorHandler(err, req, res, next)`

**Error Handling Flow**:

1. **Check Hold Data**: Skips if no hold data or already adjusted

2. **Vague Input Error**: For `PARSE_TASK_VAGUE_INPUT_ERROR`:

   - Extracts actual token usage from error metadata
   - Updates token usage with actual consumption
   - Returns `BadRequestError` with suggestions

3. **Other Errors**: For all other errors:
   - Sets `actualTokens` to 0 (releases full hold)
   - Updates token usage
   - Propagates original error

**Error Types**:

- **Vague Input Error**: Task parsing failed but tokens were consumed → adjust to actual usage
- **Other Errors**: Request failed before/without token consumption → release hold

### 7. Token Extraction Utility

**File**: `backend/services/tasks/src/utils/extract-openai-token-usage/extract-openai-token-usage.ts`

**Function**: `extractOpenaiTokenUsage(openaiMetadata)`

**Purpose**: Extracts total token usage from OpenAI metadata structure

**Implementation**:

```typescript
export const extractOpenaiTokenUsage = <TResult>(
  openaiMetadata: TAiCapabilityResponse<TResult>["openaiMetadata"]
) => {
  let totalTokens = 0;
  Object.values(openaiMetadata).forEach(({ tokens }) => {
    totalTokens += tokens.input + tokens.output;
  });
  return totalTokens;
};
```

**Features**:

- Sums tokens from multiple metadata entries (e.g., `core`, `secondary`)
- Handles empty metadata (returns 0)
- Type-safe with generic type parameter

### 8. Task Creation Integration

**File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`

**Changes to `createTask`**:

1. **Extract Token Usage**: After task creation, extracts actual tokens from response:

   ```typescript
   const { task, tokensUsed } = await createTaskHandler(...);
   ```

2. **Store Actual Tokens**: Sets actual token usage in `res.locals.tokenUsage`:

   ```typescript
   if (res.locals.tokenUsage) {
     res.locals.tokenUsage.actualTokens = tokensUsed;
   }
   ```

3. **Continue Middleware Chain**: Calls `next()` to continue to post-response middleware

**Service Layer Changes**:

**File**: `backend/services/tasks/src/services/tasks-service/tasks-service.ts`

- `createTaskHandler` now returns `{ task, tokensUsed }` instead of just `task`
- Token usage is extracted from OpenAI metadata in the AI capability response

### 9. Route Integration

**File**: `backend/services/tasks/src/routers/tasks-router.ts`

**Middleware Chain for Task Creation**:

```typescript
tasksRouter.post(
  "/",
  [
    validateSchema(createTaskSchema),
    openaiTokenUsageRateLimiter.createTask, // Pre-request: hold tokens
  ],
  createTask, // Controller: process request
  openaiUpdateTokenUsage // Post-response: adjust tokens
);

tasksRouter.use(tokenUsageErrorHandler); // Error handler: adjust on errors
```

**Middleware Order**:

1. **Schema Validation**: Validates request body
2. **Token Usage Rate Limiter**: Holds estimated tokens
3. **Create Task Controller**: Processes request, sets actual tokens
4. **Update Token Usage**: Adjusts tokens after successful response
5. **Error Handler**: Adjusts tokens on errors (before global error handler)

### 10. Configuration

**File**: `backend/services/tasks/src/config/env.ts`

**New Environment Variables**:

```typescript
OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME: string;
OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_TOKENS_LIMIT: number;
OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_SIZE_SECONDS: number;
OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS: number;
CREATE_TASK_ESTIMATED_TOKEN_USAGE: number;
```

**Configuration Usage**:

**File**: `backend/services/tasks/src/middlewares/token-usage-rate-limiter.ts`

```typescript
const createTaskTokenUsageRateLimiterConfig: TokenUsageRateLimiterConfig = {
  serviceName: env.SERVICE_NAME,
  rateLimiterName: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_NAME,
  windowTokensLimit: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_TOKENS_LIMIT,
  windowSizeSeconds: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_WINDOW_SIZE_SECONDS,
  estimatedTokens: env.CREATE_TASK_ESTIMATED_TOKEN_USAGE,
  lockTtlMs: env.OPENAI_TOKEN_USAGE_RATE_LIMITER_LOCK_TTL_MS,
};
```

### 11. Type Definitions

**Express Locals Extension**:

**File**: `backend/shared/src/types/express.d.ts`

```typescript
interface Locals {
  tokenUsage?: {
    tokensReserved: number;
    windowStartTimestamp: number;
    actualTokens?: number;
  };
}
```

**Token Usage State Type**:

**File**: `backend/shared/src/types/token-usage-state.ts`

```typescript
export type TokenUsageState = {
  allowed: boolean;
  tokensUsed: number;
  tokensReserved: number;
  tokensRemaining: number;
  windowStartTimestamp: number;
};
```

**Token Usage Rate Limiter Config**:

**File**: `backend/shared/src/types/token-usage-rate-limiter-config.ts`

```typescript
export type TokenUsageRateLimiterConfig = {
  serviceName: string;
  rateLimiterName: string;
  windowTokensLimit: number;
  windowSizeSeconds: number;
  estimatedTokens: number;
  lockTtlMs: number;
};
```

### 12. Constants

**File**: `backend/shared/src/constants/token-usage.ts`

```typescript
export const TOKEN_USAGE_FIELD_TOKENS_USED = "tokensUsed";
export const TOKEN_USAGE_FIELD_WINDOW_START_TIMESTAMP = "windowStartTimestamp";
```
