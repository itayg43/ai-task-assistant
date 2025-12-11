# Tasks Retrieval with Pagination Implementation

## Overview

This document summarizes the implementation of task number 1 from the "Near-Term Enhancements" section: **Tasks Retrieval with Pagination**. The implementation adds a paginated `GET /tasks` endpoint with filtering, sorting, and pagination support, always filtering by `userId` for security.

## Architecture Changes

### API Endpoint

- **Route**: `GET /api/v1/tasks` (changed from `/api/v1/tasks/tasks`)
- **Method**: GET
- **Authentication**: Required (userId extracted from authentication context)
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

**Key Features**:

- Type coercion for numeric query parameters
- Nullish coalescing (`??`) for default values
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

## Code Organization Improvements

### Constants Centralization

- **Before**: Constants defined inline in schema files
- **After**: All GET /tasks constants moved to `backend/services/tasks/src/constants/get-tasks.ts`
- **Benefits**: Single source of truth, easier maintenance, better reusability

### Type Definitions Organization

- **Before**: Types defined alongside schemas and controllers
- **After**: Types organized into dedicated files:
  - `types/tasks-controller-input.ts`: Input types (inferred from schemas)
  - `types/tasks-controller-response.ts`: Response types
- **Benefits**: Clear separation of concerns, easier to find and maintain types

### Mock Data Consolidation

- **Before**: Duplicated mock definitions across multiple test files
- **After**: All mocks centralized in `mocks/tasks-mocks.ts`
- **New Mocks**:
  - `mockGetTasksInputQuery`: Mock query parameters for GET /tasks
  - `mockFindTasksResult`: Mock repository result
- **Benefits**: DRY principle, consistent test data, easier updates

## Technical Decisions

### 1. Type Safety with `satisfies`

- **Decision**: Use `satisfies` operator for default values in schema transforms
- **Rationale**: Provides compile-time type checking without widening types
- **Example**: `orderBy: (data.orderBy ?? "createdAt") satisfies TaskOrderByFields`

### 2. Zod Coercion

- **Decision**: Use `z.coerce.number()` for `skip` and `take` parameters
- **Rationale**: Query parameters are strings, coercion handles conversion automatically
- **Benefit**: Cleaner code, automatic type conversion

### 3. Nullish Coalescing vs Logical OR

- **Decision**: Use `??` for defaults, `||` for empty string conversion
- **Rationale**:
  - `??` only checks for `null`/`undefined` (preserves `0` and `false`)
  - `||` converts falsy values (including empty strings) to `undefined`
- **Usage**:
  - `skip: data.skip ?? GET_TASKS_DEFAULT_SKIP` (preserves `0`)
  - `category: data.category || undefined` (converts `""` to `undefined`)

### 4. Standalone Schema for GET Requests

- **Decision**: `getTasksSchema` is a standalone `z.object`, not extending `baseRequestSchema`
- **Rationale**: GET requests don't have a body, `baseRequestSchema` implicitly required `body`
- **Benefit**: Avoids validation errors for GET requests

### 5. Storing Validated Query/Params in `res.locals`

- **Decision**: Store validated query and params in `res.locals` instead of `req.query`/`req.params`
- **Rationale**: Express `req.query` and `req.params` are read-only properties
- **Implementation**: Added `validatedQuery` and `validatedParams` to `Express.Locals` type
- **Utility**: Created `getValidatedQuery` and `getValidatedParams` for type-safe access

### 6. Pagination Metadata

- **Decision**: Include `currentPage` and `totalPages` in pagination response
- **Rationale**: Better UX for clients, enables proper pagination UI
- **Calculation**:
  - `currentPage = Math.floor(skip / take) + 1`
  - `totalPages = totalCount > 0 ? Math.ceil(totalCount / take) : 0`
- **Edge Case**: Handles `totalCount = 0` to avoid division by zero

### 7. RESTful Route Design

- **Decision**: Use same base path `/` with different HTTP methods
- **Rationale**: Follows RESTful conventions, cleaner API design
- **Changes**:
  - `POST /create` → `POST /`
  - `GET /tasks` → `GET /`

### 8. Constants Extraction

- **Decision**: Extract all magic numbers and enums to constants file
- **Rationale**: Single source of truth, easier maintenance, better testability
- **File**: `backend/services/tasks/src/constants/get-tasks.ts`

### 9. Type Organization

- **Decision**: Separate input and response types into dedicated files
- **Rationale**: Clear separation of concerns, easier to find and maintain
- **Files**:
  - `types/tasks-controller-input.ts`: Input types
  - `types/tasks-controller-response.ts`: Response types

### 10. Mock Consolidation

- **Decision**: Centralize all test mocks in `mocks/tasks-mocks.ts`
- **Rationale**: DRY principle, consistent test data, easier updates
- **Benefits**: Reduced duplication, easier maintenance
