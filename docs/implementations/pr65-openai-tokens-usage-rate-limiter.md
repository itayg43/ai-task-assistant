# Token Usage Rate Limiter Implementation

## Overview

This document summarizes the implementation of the **Token Usage Rate Limiter** feature from PR #65. This feature adds distributed rate limiting for OpenAI token usage, tracking actual token consumption during task creation and reconciling reservations based on real usage. The system uses Redis for distributed state management and Redlock for distributed locking to ensure consistency across multiple service instances.

## Architecture Changes

### Core Concept

The token usage rate limiter implements a **fixed-window rate limiting** strategy that:

1. **Reserves** estimated tokens before processing a request
2. **Tracks** actual token usage from OpenAI API responses
3. **Reconciles** the difference between reserved and actual tokens after processing
4. **Resets** the window periodically based on configured window size

### Key Components

1. **Token Usage Rate Limiter Middleware**: Pre-request middleware that reserves tokens
2. **Token Usage Update Middleware**: Post-response middleware that reconciles actual usage
3. **Token Usage Error Handler**: Error middleware that handles token reconciliation on failures
4. **Token Usage State Utilities**: Redis operations for managing token usage state
5. **Token Usage Processing**: Core logic for checking limits and reserving tokens

## Implementation Details

### 1. Token Usage State Management

**File**: `backend/shared/src/utils/token-bucket/token-bucket-state-utils/token-bucket-state-utils.ts`

The system uses Redis hash fields to store token usage state:

- `tokensUsed`: Current number of tokens consumed in the window
- `windowStartTimestamp`: Timestamp marking the start of the current window

**Key Functions**:

- `getTokenUsageState(redisClient, key, defaultWindowStartTimestamp)`: Retrieves current token usage state
- `incrementTokenUsage(redisClient, key, amount)`: Atomically increments token usage using `HINCRBY`
- `decrementTokenUsage(redisClient, key, amount)`: Atomically decrements token usage using `HINCRBY`
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

5. **Reserve Tokens**: Atomically increments token usage by estimated amount

6. **Return Result**: Returns `TokenUsageState` with reservation details

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

3. **Calculate Difference**: Computes difference between reserved and actual tokens:

   ```typescript
   const diff = reservedTokens - actualTokens;
   ```

4. **Reconcile Tokens**:
   - **diff === 0**: No adjustment needed (reserved matches actual)
   - **diff > 0**: Release excess tokens (reserved more than used)
   - **diff < 0**: Increment additional tokens (used more than reserved)

**Scenarios**:

- **Perfect Estimate**: Reserved tokens match actual usage → no change
- **Over-Estimated**: Reserved more than needed → decrement excess
- **Under-Estimated**: Used more than reserved → increment difference

### 4. Token Usage Rate Limiter Middleware

**File**: `backend/shared/src/middlewares/token-usage-rate-limiter/create-token-usage-rate-limiter/create-token-usage-rate-limiter.ts`

**Function**: `createTokenUsageRateLimiter(redisClient, redlockClient, config)`

**Middleware Flow**:

1. **Extract User Context**: Gets `userId` from authentication context

2. **Acquire Distributed Lock**: Uses Redlock to ensure atomic operations across instances

3. **Process Token Usage**: Calls `processTokenUsage` to check limits and reserve tokens

4. **Handle Rate Limit**: If not allowed, throws `TooManyRequestsError` (429)

5. **Store Reservation**: Stores reservation data in `res.locals.tokenUsage`:

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

1. **Check Reservation**: Only processes if `tokenUsage` exists and `actualTokens` is set

2. **Extract Data**: Gets reservation and actual token usage from `res.locals.tokenUsage`

3. **Async Update**: Uses `setImmediate` to update token usage asynchronously (non-blocking)

4. **Acquire Lock**: Uses Redlock for atomic update operation

5. **Update Usage**: Calls `updateTokenUsage` to reconcile tokens

6. **Error Handling**: Logs errors but doesn't fail the request (best-effort reconciliation)

**Key Design Decision**: Updates happen asynchronously to avoid blocking the HTTP response

### 6. Token Usage Error Handler

**File**: `backend/services/tasks/src/middlewares/token-usage-error-handler/token-usage-error-handler.ts`

**Function**: `tokenUsageErrorHandler(err, req, res, next)`

**Error Handling Flow**:

1. **Check Reservation**: Skips if no reservation or already reconciled

2. **Vague Input Error**: For `PARSE_TASK_VAGUE_INPUT_ERROR`:

   - Extracts actual token usage from error metadata
   - Updates token usage with actual consumption
   - Returns `BadRequestError` with suggestions

3. **Other Errors**: For all other errors:
   - Sets `actualTokens` to 0 (releases full reservation)
   - Updates token usage
   - Propagates original error

**Error Types**:

- **Vague Input Error**: Task parsing failed but tokens were consumed → reconcile actual usage
- **Other Errors**: Request failed before/without token consumption → release reservation

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
    openaiTokenUsageRateLimiter.createTask, // Pre-request: reserve tokens
  ],
  createTask, // Controller: process request
  openaiUpdateTokenUsage // Post-response: reconcile tokens
);

tasksRouter.use(tokenUsageErrorHandler); // Error handler: reconcile on errors
```

**Middleware Order**:

1. **Schema Validation**: Validates request body
2. **Token Usage Rate Limiter**: Reserves estimated tokens
3. **Create Task Controller**: Processes request, sets actual tokens
4. **Update Token Usage**: Reconciles tokens after successful response
5. **Error Handler**: Reconciles tokens on errors (before global error handler)

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

## Technical Decisions

### 1. Fixed-Window Rate Limiting

- **Decision**: Use fixed-window instead of sliding-window or token bucket
- **Rationale**: Simpler implementation, predictable reset behavior, easier to reason about
- **Trade-off**: Potential burst at window boundaries, but acceptable for token usage tracking

### 2. Token Reservation Before Processing

- **Decision**: Reserve estimated tokens before processing the request
- **Rationale**: Prevents exceeding limits even if actual usage is higher
- **Benefit**: Guarantees we never exceed the window limit

### 3. Post-Response Reconciliation

- **Decision**: Reconcile actual vs reserved tokens after response is sent
- **Rationale**: Accurate tracking without blocking the HTTP response
- **Implementation**: Uses `setImmediate` for async updates

### 4. Distributed Locking with Redlock

- **Decision**: Use Redlock for distributed locking
- **Rationale**: Ensures atomic operations across multiple service instances
- **Benefit**: Prevents race conditions in distributed environments

### 5. Error Handling Strategy

- **Decision**: Handle token reconciliation in error middleware
- **Rationale**: Ensures tokens are reconciled even when requests fail
- **Implementation**:
  - Vague input errors: Extract actual usage from error metadata
  - Other errors: Release full reservation (set actualTokens to 0)

### 6. Redis Hash Fields

- **Decision**: Store token usage state in Redis hash fields
- **Rationale**: Atomic operations (`HINCRBY`), efficient updates, single key per user
- **Benefit**: Better performance than separate keys

### 7. Window Reset Logic

- **Decision**: Reset window when `windowStartTimestamp` changes
- **Rationale**: Fixed-window behavior with automatic reset
- **Implementation**: Calculate window start, compare with stored value, reset if different

### 8. Async Token Updates

- **Decision**: Update token usage asynchronously after response
- **Rationale**: Don't block HTTP response for Redis operations
- **Trade-off**: Small window where state might be slightly inaccurate, but acceptable

### 9. Estimated Tokens Configuration

- **Decision**: Use configurable estimated tokens per operation
- **Rationale**: Different operations consume different amounts of tokens
- **Benefit**: Flexible configuration per endpoint/operation

### 10. Token Extraction from Metadata

- **Decision**: Extract tokens from OpenAI metadata structure
- **Rationale**: Centralized extraction logic, handles multiple metadata entries
- **Implementation**: Sums `input + output` tokens from all metadata entries
