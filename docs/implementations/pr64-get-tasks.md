# Tasks Retrieval with Pagination Implementation

## Overview

This document summarizes the implementation of **Tasks Retrieval with Pagination**. The implementation adds a paginated `GET /tasks` endpoint with filtering, sorting, and pagination support, always filtering by `userId` for security.

## Architecture Changes

### API Endpoint

- **Route**: `GET /api/v1/tasks` (changed from `/api/v1/tasks/tasks`)
- **Method**: GET
- **Authentication**: Required (userId extracted from authentication context for security)
- **Query Parameters**:
  - `skip` (optional): Number of records to skip (default: 0)
  - `take` (optional): Number of records to return (default: 10, min: 1, max: 100)
  - `orderBy` (optional): Field to sort by - `"dueDate"`, `"priorityScore"`, or `"createdAt"` (default: `"createdAt"`)
  - `orderDirection` (optional): Sort direction - `"asc"` or `"desc"` (default: `"desc"`)
  - `category` (optional): Filter by task category
  - `priorityLevel` (optional): Filter by priority level

### Response Structure

```typescript
{
  tasksServiceRequestId: string;
  tasks: TaskResponse[];
  pagination: {
    totalCount: number;
    skip: number;
    take: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
}
```

## Implementation Details

### 1. Repository Layer

**File**: `backend/services/tasks/src/repositories/tasks-repository/tasks-repository.ts`

- **Function**: `findTasks(client, userId, options)`
- **Changes**:
  - Renamed from `findTasksPaginated` to `findTasks`
  - Always filters by `userId` for security
  - Supports dynamic `where` clause for filtering (category, priorityLevel)
  - Supports dynamic `orderBy` and `orderDirection` for sorting
  - Returns `FindTasksResult` with `tasks`, `totalCount`, and `hasMore`

**Type Definitions**:

```typescript
export type TaskOrderByFields = "dueDate" | "priorityScore" | "createdAt";

export type FindTasksOptions = {
  skip: number;
  take: number;
  orderBy: TaskOrderByFields;
  orderDirection: Prisma.SortOrder;
  where?: TaskWhereFields;
};

export type TaskWhereFields = Omit<
  Prisma.TaskWhereInput,
  "userId" | "subtasks"
>;

export type FindTasksResult = {
  tasks: Task[];
  totalCount: number;
  hasMore: boolean;
};
```

### 2. Service Layer

**File**: `backend/services/tasks/src/services/tasks-service/tasks-service.ts`

- **Function**: `getTasksHandler(userId, options)`
- **Changes**:
  - Wraps repository `findTasks` call
  - Passes through pagination, sorting, and filtering options
  - Returns the same `FindTasksResult` structure

### 3. Controller Layer

**File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.ts`

- **Function**: `getTasks(req, res, next)`
- **Changes**:
  - Extracts validated query parameters using `getValidatedQuery<GetTasksInput["query"]>(res)`
  - Constructs `where` object from optional `category` and `priorityLevel` filters
  - Calculates `currentPage` and `totalPages` for pagination metadata
  - Returns `GetTasksResponse` with tasks and pagination info

**Pagination Calculation**:

```typescript
currentPage: Math.floor(skip / take) + 1;
totalPages: result.totalCount > 0 ? Math.ceil(result.totalCount / take) : 0;
```

### 4. Schema Validation

**File**: `backend/services/tasks/src/schemas/tasks-schemas.ts`

- **Schema**: `getTasksSchema`
- **Changes**:
  - Standalone `z.object` (not extending `baseRequestSchema`) to support GET requests without body
  - Uses `z.coerce.number()` for `skip` and `take` to handle string-to-number conversion
  - Uses `.nullish()` for optional parameters
  - Uses `.transform()` to apply defaults:
    - `skip`: defaults to `GET_TASKS_DEFAULT_SKIP` (0)
    - `take`: defaults to `GET_TASKS_DEFAULT_TAKE` (10)
    - `orderBy`: defaults to `"createdAt"`
    - `orderDirection`: defaults to `"desc"`
  - Uses `satisfies` operator for type-safe defaults
  - Uses `.pipe()` for post-transform validation
  - Converts empty strings to `undefined` for optional filters (`category`, `priorityLevel`)

**Key Implementation Details**:

- Type coercion for numeric query parameters using `z.coerce.number()`
- Nullish coalescing (`??`) for default values (preserves `0` and `false`)
- Logical OR (`||`) for converting empty strings to `undefined`
- Type-safe defaults using `satisfies` operator

### 5. Constants

**File**: `backend/services/tasks/src/constants/get-tasks.ts`

- **Purpose**: Centralized constants for GET /tasks endpoint
- **Constants**:
  - `GET_TASKS_ALLOWED_ORDER_BY_FIELDS`: Tuple type for allowed sort fields
  - `GET_TASKS_ALLOWED_ORDER_DIRECTIONS`: Tuple type for allowed sort directions
  - `GET_TASKS_DEFAULT_SKIP`: Default skip value (0)
  - `GET_TASKS_DEFAULT_TAKE`: Default take value (10)
  - `GET_TASKS_MIN_TAKE`: Minimum take value (1)
  - `GET_TASKS_MAX_TAKE`: Maximum take value (100)

### 6. Type Definitions

**Input Types** (`backend/services/tasks/src/types/tasks-controller-input.ts`):

- `CreateTaskInput`: Inferred from `createTaskSchema`
- `GetTasksInput`: Inferred from `getTasksSchema`

**Response Types** (`backend/services/tasks/src/types/tasks-controller-response.ts`):

- `CreateTaskResponse`: Response for task creation
- `GetTasksResponse`: Response for task retrieval with pagination metadata

### 7. Middleware Enhancements

**File**: `backend/shared/src/middlewares/validate-schema/validate-schema.ts`

- **Changes**:
  - Stores validated `query` in `res.locals.validatedQuery` (Express `req.query` is read-only)
  - Stores validated `params` in `res.locals.validatedParams`
  - Explicit checks for `body`, `query`, and `params` before assignment
  - Simplified error handling (just `next(error)`)

**File**: `backend/shared/src/types/express.d.ts`

- **Changes**:
  - Added `validatedQuery?: Record<string, unknown>` to `Express.Locals`
  - Added `validatedParams?: Record<string, unknown>` to `Express.Locals`

### 8. Utility Functions

**File**: `backend/shared/src/utils/validated-query/validated-query.ts`

- **Function**: `getValidatedQuery<T>(res)`
- **Purpose**: Type-safe retrieval of validated query parameters from `res.locals`
- **Usage**: `const query = getValidatedQuery<GetTasksInput["query"]>(res)`

**File**: `backend/shared/src/utils/validated-params/validated-params.ts`

- **Function**: `getValidatedParams<T>(res)`
- **Purpose**: Type-safe retrieval of validated path parameters from `res.locals`
- **Usage**: `const params = getValidatedParams<SomeInput["params"]>(res)`

### 9. Route Changes

**File**: `backend/services/tasks/src/routers/tasks-router.ts`

- **Changes**:
  - Changed `POST /create` to `POST /`
  - Changed `GET /tasks` to `GET /`
  - Both endpoints now use the same base path `/` with different HTTP methods (RESTful design)
