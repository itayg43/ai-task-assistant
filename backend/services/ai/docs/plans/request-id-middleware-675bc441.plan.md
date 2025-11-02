<!-- 675bc441-e59e-4d5f-a1d5-f1238fe8e98b de1b5dc9-5f00-4951-b5cb-cf175d1d147f -->

# Request ID Middleware Implementation

## Overview

Add request ID tracking throughout the AI service for better observability, distributed tracing, and debugging. The middleware will be created in the shared package for reusability, with request IDs included in response bodies and propagated through all layers of the application.

## Implementation Steps

### ✅ 1. Install uuid Package in Shared

Add `uuid` and `@types/uuid` as dependencies to the shared package. _(Completed — added to `backend/shared/package.json` and installed via `npm install`.)_

**File:** `backend/shared/package.json`

- Add to dependencies: `"uuid": "^11.0.3"`
- Add to devDependencies: `"@types/uuid": "^10.0.0"`

### ✅ 2. Create Request ID Middleware in Shared

Create a reusable middleware in the shared package that generates a UUID and stores it in `res.locals.requestId`. _(Completed — middleware lives at `backend/shared/src/middlewares/request-id/request-id.ts` with index export.)_

**New File:** `backend/shared/src/middlewares/request-id/request-id.ts`

```typescript
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  res.locals.requestId = uuidv4();
  next();
};
```

**New File:** `backend/shared/src/middlewares/request-id/index.ts`

```typescript
export { requestId } from "./request-id";
```

### ✅ 3. Extend Shared Express Types

Update the shared Express type definitions to include optional `requestId` in `response.locals`. _(Completed — updated `backend/shared/src/types/express.d.ts`.)_

**File:** `backend/shared/src/types/express.d.ts`

```typescript
declare global {
  namespace Express {
    interface Locals {
      authenticationContext?: AuthenticationContext;
      requestId?: string; // Add this (optional in shared)
    }
  }
}
```

### ✅ 4. Update Shared Request-Response Metadata Middleware

Include optional request ID in the request-response metadata logs. _(Completed and covered by unit tests.)_

**File:** `backend/shared/src/middlewares/request-response-metadata/request-reponse-metadata.ts`

```typescript
// Update line 18-25
const requestMetadata = {
  requestId: res.locals.requestId, // Add this (optional)
  method: req.method,
  originalUrl: req.originalUrl,
  userAgent: req.get("User-Agent"),
  authenticationContext: !req.originalUrl.includes(HEALTH_ROUTE)
    ? getAuthenticationContext(res)
    : undefined,
};
```

### ✅ 5. Update Shared Error Handler

Include optional request ID in error responses and logs. _(Completed with updated tests.)_

**File:** `backend/shared/src/middlewares/error-handler/error-handler.ts`

```typescript
// Update line 16-29
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const { status, message } = extractErrorInfo(error);
  const requestId = res.locals.requestId;

  logger.error(message, error, { requestId });

  res.status(status).json({
    message,
    requestId, // Include in error response body
  });
};
```

### ✅ 6. Rebuild Shared Package

After making changes to the shared package, rebuild it so the AI service can use the updated types and middleware. _(Completed via `npm run build`.)_

**Command:**

```bash
cd backend/shared
npm run build
```

### ✅ 7. Extend AI Service Express Types

Update the AI service Express type definitions to include required `requestId` in `response.locals`. _(Completed — `requestId` now required in `backend/services/ai/src/types/express.d.ts`. Also constrained `capabilityConfig` output type to `Record<string, unknown>` to fix TypeScript spread operator compilation issues.)_

**File:** `backend/services/ai/src/types/express.d.ts`

```typescript
interface Locals {
  capabilityConfig?: CapabilityConfig<any, Record<string, unknown>>;
  requestId: string; // Add this (required in AI service)
}
```

### ✅ 8. Add Request ID Middleware to AI Service App

Register the request ID middleware in `app.ts` before authentication to track all requests including authentication failures. _(Completed for both the health route and capabilities router.)_

**File:** `backend/services/ai/src/app.ts`

```typescript
import { requestId } from "@shared/middlewares/request-id";

// Update the capabilities route registration (line 23-27)
app.use(
  "/api/v1/ai/capabilities",
  [requestId, authentication, requestResponseMetadata],
  capabilitiesRouter
);
```

Optional: Add to health endpoint for complete traceability:

```typescript
app.use(HEALTH_ROUTE, [requestId, requestResponseMetadata], healthRouter);
```

### ✅ 9. Update Capability Handler Signature

Modify the capability handler signature to accept requestId as a second parameter. This is a BREAKING CHANGE that will require updates to all handlers and tests. _(Completed — `CapabilityConfig.handler` now receives `(input, requestId)`.)_

**File:** `backend/services/ai/src/types/capability-config.ts`

```typescript
export type CapabilityConfig<TInput, TOutput> = {
  name: Capability;
  handler: (input: TInput, requestId: string) => Promise<TOutput>;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
};
```

### ✅ 10. Update Execute Sync Pattern

Pass requestId to the handler in the execute sync pattern. _(Completed with tests updated.)_

**File:** `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/execute-sync-pattern.ts`

```typescript
export const executeSyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string // Add parameter
) => {
  const { result, durationMs } = await withDurationAsync(async () => {
    return await withRetry(
      DEFAULT_RETRY_CONFIG,
      () => config.handler(input, requestId) // Pass requestId
    );
  });

  return {
    result,
    durationMs,
  };
};
```

### ✅ 11. Update Controller to Pass Request ID

Modify the capabilities controller to extract requestId, include it in logs, pass it to the executor, and include it in the response body. _(Completed — controller now logs and returns `requestId`. Also updated `getCapabilityConfig` utility to explicitly return `CapabilityConfig<any, Record<string, unknown>>` for proper type inference.)_

**File:** `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.ts`

```typescript
// Add after line 21
const requestId = res.locals.requestId;

// Update logger calls to include requestId
logger.info("executeCapability - starting", {
  requestId,
  capability,
  pattern,
  input: req.body,
});

// Pass requestId to executor
const executorResult = await patternExecutor(
  config,
  {
    body: req.body,
    params: req.params,
    query: req.query,
  },
  requestId
);

logger.info("executeCapability - succeeded", {
  requestId,
  capability,
  pattern,
  result: executorResult.result,
  totalDurationMs: executorResult.durationMs,
});

logger.error("executeCapability - failed", error, {
  requestId,
  capability,
  pattern,
  input: req.body,
});

// Include requestId in response body
res.status(StatusCodes.OK).json({
  ...executorResult.result,
  requestId,
});
```

**File:** `backend/services/ai/src/utils/get-capability-config/get-capability-config.ts`

```typescript
export const getCapabilityConfig = (
  res: Response
): CapabilityConfig<any, Record<string, unknown>> => {
  const config = res.locals.capabilityConfig;
  // ... rest of implementation
};
```

### ✅ 12. Update Parse Task Handler

Update the parse task handler to accept and use requestId parameter, passing it to OpenAI client.

**File:** `backend/services/ai/src/capabilities/parse-task/handler/parse-task-handler.ts`

```typescript
export const handler = async (
  input: ParseTaskInput,
  requestId: string // Add parameter
): Promise<CapabilityResponse<typeof parseTaskOutputSchema>> => {
  const { naturalLanguage, config } = input.body;

  const corePrompt = createCorePrompt("v1", naturalLanguage, config);
  const coreResponse = await executeParse<ParseTaskOutputCore>(
    "parse-task",
    naturalLanguage,
    corePrompt,
    requestId // Pass to executeParse
  );

  return {
    metadata: {
      tokens: {
        input: coreResponse.usage.tokens.input,
        output: coreResponse.usage.tokens.output,
      },
      durationMs: coreResponse.durationMs,
    },
    result: coreResponse.output,
  };
};
```

### ✅ 13. Update OpenAI Execute Parse Function

Update the executeParse function to accept requestId and include it in all logs. _(Completed; eval helpers generate request IDs with `crypto.randomUUID()`.)_

**File:** `backend/services/ai/src/clients/openai/openai.ts`

```typescript
export const executeParse = async <TOutput>(
  capability: Capability,
  input: string,
  prompt: ResponseCreateParamsNonStreaming,
  requestId: string // Add parameter
) => {
  try {
    logger.info("executeParse - start", {
      requestId, // Add to logs
      capability,
      input,
    });

    const response = await withDurationAsync(() =>
      openai.responses.parse<any, TOutput>(prompt)
    );

    if (!response.result.output_parsed) {
      throw new Error(
        `OpenAI failed to parse output for ${capability} capability`
      );
    }

    const result = {
      output: response.result.output_parsed,
      usage: {
        tokens: {
          input: response.result.usage?.input_tokens || 0,
          output: response.result.usage?.output_tokens || 0,
        },
      },
      durationMs: response.durationMs,
    };

    logger.info("executeParse - succeeded", {
      requestId, // Add to logs
      capability,
      input,
      result,
    });

    return result;
  } catch (error) {
    logger.error("executeParse - failed", error, {
      requestId, // Add to logs
      capability,
      input,
    });

    throw error;
  }
};
```

### ✅ 14. Update Parse Task Handler Test

Update the handler test to pass requestId parameter.

**File:** `backend/services/ai/src/capabilities/parse-task/handler/handler.test.ts`

```typescript
// Update executeHandler function (line 58-71)
const executeHandler = async () => {
  return await handler(
    {
      body: {
        naturalLanguage: mockNaturalLanguage,
        config: mockConfig,
      },
      params: {
        capability: CAPABILITY.PARSE_TASK,
      },
      query: {
        pattern: CAPABILITY_PATTERN.SYNC,
      },
    },
    "test-request-id"
  ); // Add requestId parameter
};

// Update executeParse expectation (line 93-97)
expect(mockedExecuteParse).toHaveBeenCalledWith(
  CAPABILITY.PARSE_TASK,
  mockNaturalLanguage,
  mockPrompt,
  "test-request-id" // Add requestId parameter
);
```

### ✅ 15. Update Execute Sync Pattern Test

Update the executor test to pass requestId parameter.

**File:** `backend/services/ai/src/controllers/capabilities-controller/executors/execute-sync-pattern/execute-sync-pattern.test.ts`

```typescript
// Update test (line 58-70)
it("should execute handler with retry and duration tracking", async () => {
  const mockRequestId = "test-request-id";
  const result = await executeSyncPattern(mockConfig, mockInput, mockRequestId);

  expect(withDurationAsync).toHaveBeenCalled();
  expect(withRetry).toHaveBeenCalledWith(
    DEFAULT_RETRY_CONFIG,
    expect.any(Function)
  );
  expect(mockConfig.handler).toHaveBeenCalledWith(mockInput, mockRequestId);
  expect(result).toEqual({
    result: mockResult,
    durationMs: mockDuration,
  });
});
```

### ✅ 16. Update OpenAI Client Test

Update all test calls to `executeParse` to include requestId parameter.

**File:** `backend/services/ai/src/clients/openai/openai.test.ts`

```typescript
// Add requestId parameter to all executeParse calls
await executeParse(mockCapability, mockInput, mockPrompt, "test-request-id");
```

### ✅ 17. Update Capabilities Controller Test

Add `res.locals.requestId` mock to test setup and assert response bodies include `requestId`.

**File:** `backend/services/ai/src/controllers/capabilities-controller/capabilities-controller.test.ts`

Add mock for `res.locals.requestId = "test-request-id"` in test setup.

### ✅ 18. Run Tests and Verify

Run all tests to ensure the changes work correctly:

**Commands:**

```bash
cd backend/shared
npm run build
npm test

cd ../services/ai
npm test
```

_(All commands executed successfully.)_

## Testing Checklist

- [x] Verify request ID is unique across requests _(covered via multiple supertest runs showing different IDs)_
- [x] Confirm request ID appears in all log statements (controller, handler, OpenAI client, shared metadata)
- [x] Validate request ID is included in success response bodies
- [x] Validate request ID is included in error response bodies (including auth failures)
- [x] Test that request ID persists through the entire request lifecycle _(observed in integration tests with `supertest` and shared middleware logs)_
- [x] Verify request ID is optional in shared types but required in AI service types
- [x] Run all existing tests to ensure they pass with the new requestId parameter \*(shared + ai test suites)
- [x] Test authentication failures include request ID in error response _(invalid capability/pattern cases)_
- [x] Manually test a few API calls and verify request IDs in logs and responses _(completed — verified in Docker logs showing request ID flow through all layers)_

## Notes

- Currently only `parse-task` handler exists. As new capabilities are added, ensure they follow the pattern of accepting `requestId: string` as the second parameter.
- The handler signature change is a breaking change, but since this is internal code and we're updating all references, it's safe to proceed.
- Consider adding request ID to health endpoint for complete observability, though it may add minimal overhead to health checks.
- **TypeScript Type Constraint Fix**: To resolve TypeScript compilation errors when spreading the executor result in the controller, the `capabilityConfig` type in Express locals was constrained to `CapabilityConfig<any, Record<string, unknown>>` instead of `CapabilityConfig<any, any>`. This ensures TypeScript knows capability outputs are always objects that can be safely spread. The `getCapabilityConfig` utility was also updated to explicitly return this constrained type for proper type inference throughout the call chain.

### To-dos

- [x] Install uuid package and type definitions
- [x] Extend Express types to include requestId in response.locals (optional in shared, required in AI service)
- [x] Create request ID middleware that generates UUID
- [x] Add request ID middleware to capabilities router (and health route)
- [x] Update controller to include request ID in all logs and response bodies
- [x] Update error handler to include request ID in errors
- [x] Update request-response metadata middleware to include request ID
- [x] Perform manual API verification of request IDs in logs/responses
- [x] Fix TypeScript compilation error by constraining capabilityConfig output type to `Record<string, unknown>`
