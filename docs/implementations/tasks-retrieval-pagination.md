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

## Testing Improvements

### Unit Tests

**File**: `backend/services/tasks/src/repositories/tasks-repository/tasks-repository.unit.test.ts`

- **Changes**:
  - Added `executeFindTasks` helper function to reduce boilerplate
  - Consolidated filter tests using `it.each`
  - Used `it.each` for `hasMore` edge cases
  - All tests use the helper for consistency

**File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.unit.test.ts`

- **Changes**:
  - Updated to use `mockGetTasksInputQuery` and `mockFindTasksResult` from shared mocks
  - Updated to use `getValidatedQuery` instead of direct `req.query` access
  - Simplified assertions using shared mocks

### Integration Tests

**File**: `backend/services/tasks/src/controllers/tasks-controller/tasks-controller.integration.test.ts`

- **Changes**:
  - Updated route paths from `/create` and `/tasks` to `/`
  - Used `it.each` for testing all `orderBy` fields and `orderDirection` values
  - Added assertions for `currentPage` and `totalPages` in pagination metadata
  - Used shared mocks (`mockGetTasksInputQuery`, `mockFindTasksResult`)

**File**: `backend/services/tasks/src/repositories/tasks-repository/tasks-repository.integration.test.ts`

- **Changes**:
  - Moved pagination test to the top
  - Removed subtasks assertions (not part of filtering)
  - Changed `userId` filter test to check `userId` property directly
  - Refactored sorting tests to use `it.each` with `GET_TASKS_ALLOWED_ORDER_DIRECTIONS`
  - Removed redundant sorting tests

**File**: `backend/shared/src/middlewares/validate-schema/validate-schema.test.ts`

- **Changes**:
  - Added tests for explicit success cases (body, query, params)
  - Added tests for storing validated query/params in `res.locals`
  - Added tests for not storing query/params if not defined in schema
  - Fixed TypeScript errors with proper type casting

### New Test Files

**File**: `backend/shared/src/utils/validated-query/validated-query.test.ts`

- Tests for `getValidatedQuery` utility function
- Tests error handling when validated query is missing

**File**: `backend/shared/src/utils/validated-params/validated-params.test.ts`

- Tests for `getValidatedParams` utility function
- Tests error handling when validated params is missing

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

## File Structure

### New Files

```
backend/services/tasks/src/
├── constants/
│   └── get-tasks.ts                    # GET /tasks constants
├── types/
│   ├── tasks-controller-input.ts       # Input types
│   └── tasks-controller-response.ts    # Response types
└── mocks/
    └── tasks-mocks.ts                  # (updated) Added new mocks

backend/shared/src/
├── utils/
│   ├── validated-query/
│   │   ├── validated-query.ts          # Type-safe query retrieval
│   │   └── validated-query.test.ts     # Tests
│   └── validated-params/
│       ├── validated-params.ts         # Type-safe params retrieval
│       └── validated-params.test.ts   # Tests
└── types/
    └── express.d.ts                    # (updated) Added validatedQuery/validatedParams
```

### Modified Files

```
backend/services/tasks/src/
├── schemas/
│   └── tasks-schemas.ts                # Removed types, added getTasksSchema
├── repositories/
│   └── tasks-repository/
│       ├── tasks-repository.ts         # Renamed findTasksPaginated → findTasks
│       ├── tasks-repository.unit.test.ts      # Refactored with helper
│       └── tasks-repository.integration.test.ts # Refactored tests
├── services/
│   └── tasks-service/
│       └── tasks-service.ts            # Updated to use findTasks
├── controllers/
│   └── tasks-controller/
│       ├── tasks-controller.ts         # Added getTasks, removed inline types
│       ├── tasks-controller.unit.test.ts       # Updated to use shared mocks
│       └── tasks-controller.integration.test.ts # Updated routes, added tests
├── routers/
│   └── tasks-router.ts                 # Changed routes to RESTful design
├── constants/
│   └── index.ts                        # Exports GET_TASKS_* constants
└── types/
    └── index.ts                         # Exports input and response types

backend/shared/src/
└── middlewares/
    └── validate-schema/
        ├── validate-schema.ts          # Store query/params in res.locals
        └── validate-schema.test.ts     # Added new test cases
```

## Testing Summary

### Test Coverage

- **Unit Tests**: 48 tests passing across 6 test files
- **Integration Tests**: Full coverage of GET /tasks endpoint
- **Edge Cases**: Tested pagination boundaries, empty results, filtering, sorting

### Key Test Scenarios

1. **Pagination**:

   - Default pagination (skip=0, take=10)
   - Custom pagination values
   - Edge cases (skip=0, take=1, hasMore calculation)
   - Empty result set (totalCount=0)

2. **Filtering**:

   - Filter by category
   - Filter by priorityLevel
   - Combined filters
   - Non-existent filters (empty results)

3. **Sorting**:

   - All orderBy fields (dueDate, priorityScore, createdAt)
   - Both order directions (asc, desc)
   - Default sorting (createdAt desc)

4. **Type Safety**:

   - Validated query parameters
   - Type-safe response types
   - Error handling for missing validated data

5. **Route Changes**:
   - POST / (create task)
   - GET / (get tasks)

## Migration Notes

### Breaking Changes

1. **Route Changes**:

   - `POST /api/v1/tasks/create` → `POST /api/v1/tasks`
   - `GET /api/v1/tasks/tasks` → `GET /api/v1/tasks`

2. **Response Structure**:
   - Added `pagination` object with `currentPage` and `totalPages`
   - `hasMore` field added to pagination metadata

### Backward Compatibility

- No database schema changes required
- Existing task creation endpoint remains functional
- New endpoint is additive (doesn't break existing functionality)

## Performance Considerations

1. **Database Queries**:

   - Uses `Promise.all` for parallel execution of `findMany` and `count`
   - Indexes on `userId`, `category`, `priorityLevel`, `dueDate`, `priorityScore`, `createdAt` recommended

2. **Pagination Limits**:

   - Maximum `take` value of 100 prevents excessive data transfer
   - Default `take` of 10 provides reasonable page size

3. **Filtering**:
   - Filters are applied at database level (efficient)
   - Always filters by `userId` for security

## Future Enhancements

Potential improvements for future iterations:

1. **Cursor-based Pagination**: For better performance with large datasets
2. **Additional Filters**: Date range filtering, status filtering
3. **Search**: Full-text search on task titles/descriptions
4. **Sorting**: Additional sort fields (e.g., `updatedAt`, `title`)
5. **Field Selection**: Allow clients to specify which fields to return
6. **Response Caching**: Cache paginated results for frequently accessed pages

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Zod Documentation](https://zod.dev)
- [Express.js Documentation](https://expressjs.com)
- [TypeScript `satisfies` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
- [RESTful API Design](https://restfulapi.net/)
