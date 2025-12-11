# Task Assistant

This is a personal LLM-powered task assistant built with TypeScript and Node.js, integrating the OpenAI API. Built to practice backend engineering in a modular microservices architecture with type-safe code, focusing on maintainability and testability. It is intended as a learning and portfolio project rather than a fully production-ready system.

## Overview

### Architecture

```mermaid
graph TB
    Client[Client] -->|HTTP Request| Tasks[Tasks Service<br/>Port 3001]

    Tasks -->|Rate Limit Check| Redis[Redis<br/>Global Token Bucket<br/>+ OpenAI Usage Window<br/>Rate Limiting<br/>Port 6379]
    Redis -->|Allow/Deny| Tasks

    Tasks -->|Database Operations| Postgres[PostgreSQL<br/>Port 5432]
    Postgres -->|Query Results| Tasks

    Tasks -->|AI Request| AI[AI Service<br/>Port 3002]
    AI -->|OpenAI API| OpenAI[OpenAI GPT]
    OpenAI -->|AI Response| AI
    AI -->|Response| Tasks

    Tasks -->|Final Response| Client
```

### Key Features

- **Microservices Architecture**: Independent, containerized services that communicate over HTTP
- **Monorepo Code Organization**: NPM Workspaces for simplified dependency management and code sharing
- **Generic Capabilities Controller**: Extensible AI capability system with type-safe handlers
- **Prompt Versioning & Evaluation**: Systematic prompt testing and evaluation framework for AI quality assurance
- **Distributed Rate Limiting & OpenAI Usage Tracking**: Redis + Redlock token bucket plus OpenAI window limits with token reservation/reconciliation
- **Database Persistence**: PostgreSQL database with Prisma ORM for reliable task and subtask storage
- **Task Retrieval with Pagination**: Paginated task retrieval with filtering, sorting, current page, and total pages
- **Type Safety**: TypeScript and Zod schemas throughout the stack

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **AI**: OpenAI API
- **Database**: PostgreSQL with Prisma ORM
- **Caching/Locking**: Redis with Redlock
- **Containerization**: Docker & Docker Compose
- **Monorepo**: NPM Workspaces
- **Testing**: Vitest (unit, integration, prompt versioning and evaluation)
- **Validation**: Zod

## Getting Started

### Prerequisites

- Docker & Docker Compose
- OpenAI API key

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ai-task-assistant
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   # Root level
   cp .env.example .env
   # Edit .env with PostgreSQL credentials

   # AI Service
   cd backend/services/ai
   cp .env.example .env.dev
   # Edit .env.dev with your OpenAI API key
   cp .env.example .env.test
   # Edit .env.test with your OpenAI API key for prompt evaluation tests

   # Tasks Service
   cd backend/services/tasks
   cp .env.example .env.dev
   # Edit .env.dev with service configuration including:
   # DATABASE_URL=postgresql://user:password@postgres:5432/database_name

   # Create .env.test for database integration tests
   cp .env.example .env.test
   # Edit .env.test with test database configuration:
   # DATABASE_URL=postgresql://user:password@localhost:5432/test_database_name
   ```

4. **Start services**

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
   ```

   Services will be available at:

   - **Tasks Service**: `http://localhost:3001`
   - **AI Service**: `http://localhost:3002`
   - **Redis**: `localhost:6379`
   - **PostgreSQL**: `localhost:5432`

### Additional Commands

```bash
# Type checking (runs in watch mode for all workspaces)
npm run type-check

# Access Redis CLI
docker exec -it <redis_container_id> redis-cli

# Access PostgreSQL CLI
docker exec -it <postgres_container_id> psql -U <POSTGRES_USER> -d <POSTGRES_DB>

# Prisma commands (from backend/services/tasks directory)
cd backend/services/tasks
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate:dev  # Run database migrations
npm run prisma:seed  # Seed database with sample data (25 tasks with subtasks)

# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f tasks
```

### Running Tests

```bash
# Run all tests
npm test

# Run prompt evaluation tests (requires .env.test in backend/services/ai)
npm run test:prompts

# Run database integration tests (requires .env.test in backend/services/tasks)
npm run test:db

# Run tests for specific workspace
npm test -w backend/services/ai
npm test -w backend/services/tasks
npm test -w backend/shared
```

**Important Notes for `npm run test:db`:**

- The test database should be separate from development database
- The `test:db` script automatically resets the test database before running
- Tests run sequentially to avoid race conditions with shared database state
- Ensure PostgreSQL is running and accessible before running tests
- The test suite will clean up data after each test, but uses a real database connection

## Continuous Integration

Usage of GitHub Actions for automated testing and quality assurance:

- **Automatic Testing**: Tests run automatically on all pull requests targeting `main` and on all pushes to `main`
- **Branch Protection**: The `main` branch is protected with the following rules:
  - All tests must pass before merging
  - Branches must be up to date with `main` before merging
  - Status checks are required and cannot be bypassed
- **Test Coverage**: The CI workflow runs all unit and integration tests

## API Examples

### Create Task

**1. Client Request to Tasks Service:**

```http
POST /api/v1/tasks

{
  "naturalLanguage": "Plan and execute a company-wide team building event for 50 people next month with budget approval, venue booking, and activity coordination"
}
```

**2. Tasks Service → AI Service Request:**

```http
POST /capabilities/parse-task?pattern=sync

{
  "naturalLanguage": "Plan and execute a company-wide team building event for 50 people next month with budget approval, venue booking, and activity coordination",
  "config": {
    "categories": ["work", "personal", "health", "finance", "errand"],
    "priorities": {
      "levels": ["low", "medium", "high", "critical"],
      "scores": {
        "low": { "min": 0, "max": 3 },
        "medium": { "min": 4, "max": 6 },
        "high": { "min": 7, "max": 8 },
        "critical": { "min": 9, "max": 10 }
      },
      "overallScoreRange": { "min": 0, "max": 10 }
    }
  }
}
```

**3. AI Service Response to Tasks Service (HTTP 200):**

```json
{
  "openaiMetadata": {
    "core": {
      "responseId": "resp_010e5412599d42a70069227a22ef4881928d5239648da81938",
      "tokens": { "input": 1245, "output": 89 },
      "durationMs": 2852.31
    },
    "subtasks": {
      "responseId": "resp_0a542afcfb46d5250069227a225160819d86263064feb1c920",
      "tokens": { "input": 1120, "output": 45 },
      "durationMs": 2181.7
    }
  },
  "result": {
    "title": "Plan Company-Wide Team Building Event",
    "dueDate": "2026-01-06T00:00:00.000Z",
    "category": "work",
    "priority": {
      "level": "high",
      "score": 8,
      "reason": "Event involves multiple critical steps and coordination for a large group within a fixed timeframe next month"
    },
    "subtasks": [
      "Obtain Budget Approval",
      "Select Suitable Venue",
      "Book Venue",
      "Plan Team Building Activities",
      "Coordinate Activity Logistics",
      "Communicate Event Details To Employees",
      "Execute Team Building Event"
    ]
  },
  "aiServiceRequestId": "d5aacb8b-9721-46b5-8085-6b0a7f0ef753"
}
```

**4. Tasks Service Response to Client (HTTP 201):**

```json
{
  "tasksServiceRequestId": "4d2011a0-ea7f-4ccf-bc24-993bd9f804f6",
  "task": {
    "id": 7,
    "title": "Plan Company-Wide Team Building Event",
    "dueDate": "2026-01-06T00:00:00.000Z",
    "category": "work",
    "priority": {
      "level": "high",
      "score": 8,
      "reason": "Event involves multiple critical steps and coordination for a large group within a fixed timeframe next month"
    },
    "createdAt": "2025-12-06T16:46:59.698Z",
    "updatedAt": "2025-12-06T16:46:59.698Z",
    "subtasks": [
      {
        "id": 29,
        "title": "Obtain Budget Approval",
        "order": 0
      },
      {
        "id": 30,
        "title": "Select Suitable Venue",
        "order": 1
      },
      {
        "id": 31,
        "title": "Book Venue",
        "order": 2
      },
      {
        "id": 32,
        "title": "Plan Team Building Activities",
        "order": 3
      },
      {
        "id": 33,
        "title": "Coordinate Activity Logistics",
        "order": 4
      },
      {
        "id": 34,
        "title": "Communicate Event Details To Employees",
        "order": 5
      },
      {
        "id": 35,
        "title": "Execute Team Building Event",
        "order": 6
      }
    ]
  }
}
```

**Token usage behavior:** The Tasks service reserves estimated OpenAI tokens when a create request begins, then reconciles with actual usage after the AI service returns metadata (response IDs, token counts, durations). Reservations are released or adjusted even on errors to keep window-based limits accurate.

### Vague Input Error

When input is too vague, the system provides helpful suggestions:

**1. Client Request to Tasks Service:**

```http
POST /api/v1/tasks

{
  "naturalLanguage": "Plan something soon"
}
```

**2. Tasks Service → AI Service Request:**

```http
POST /capabilities/parse-task?pattern=sync

{
  "naturalLanguage": "Plan something soon",
  "config": {
    "categories": ["work", "personal", "health", "finance", "errand"],
    "priorities": {
      "levels": ["low", "medium", "high", "critical"],
      "scores": {
        "low": { "min": 0, "max": 3 },
        "medium": { "min": 4, "max": 6 },
        "high": { "min": 7, "max": 8 },
        "critical": { "min": 9, "max": 10 }
      },
      "overallScoreRange": { "min": 0, "max": 10 }
    }
  }
}
```

**3. AI Service Error Response to Tasks Service (HTTP 400):**

```json
{
  "message": "The input is too vague and generic, lacking a specific task or clear objective to plan.",
  "type": "PARSE_TASK_VAGUE_INPUT_ERROR",
  "suggestions": [
    "Specify what exactly you want to plan (e.g., a meeting, a trip, an event).",
    "Provide a timeframe or deadline for the planning.",
    "Clarify the context or category of the plan (work, personal, etc.)."
  ],
  "openaiResponseId": "resp_05c3ee527fe8911f00692285967c6c81a2abe22131a92e7453",
  "aiServiceRequestId": "d0c1cc59-4038-46e8-9e41-78b712eb3a63"
}
```

**4. Tasks Service Error Response to Client (HTTP 400):**

```json
{
  "message": "The input is too vague and generic, lacking a specific task or clear objective to plan.",
  "suggestions": [
    "Specify what exactly you want to plan (e.g., a meeting, a trip, an event).",
    "Provide a timeframe or deadline for the planning.",
    "Clarify the context or category of the plan (work, personal, etc.)."
  ],
  "tasksServiceRequestId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Token usage reconciliation on errors:** When validation fails (e.g., vague input), the token usage error handler releases or adjusts the reserved tokens via the OpenAI token usage updater. Suggestions are returned to the client; OpenAI metadata and response IDs are available in service logs for tracing.

### OpenAI API Error

When the OpenAI API encounters an error, the system handles it gracefully:

**1. Client Request to Tasks Service:**

```http
POST /api/v1/tasks

{
  "naturalLanguage": "Plan and execute a company-wide team building event for 50 people next month with budget approval, venue booking, and activity coordination"
}
```

**2. Tasks Service → AI Service Request:**

```http
POST /capabilities/parse-task?pattern=sync

{
  "naturalLanguage": "Plan and execute a company-wide team building event for 50 people next month with budget approval, venue booking, and activity coordination",
  "config": { ... }
}
```

**3. AI Service Error Response to Tasks Service (HTTP 500):**

```json
{
  "message": "Could not execute capability. Please use the request IDs for support.",
  "openaiRequestId": "req_39f99c3b9d314136b0b5a69469e068cb",
  "aiServiceRequestId": "662dbdd5-abb0-499d-bc84-a13bbc06e266"
}
```

**4. Tasks Service Error Response to Client (HTTP 500):**

```json
{
  "message": "An unexpected error occurred, Please try again or contact support.",
  "tasksServiceRequestId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

### Get Tasks

**Client Request:**

```http
GET /api/v1/tasks?skip=0&take=5&orderBy=priorityScore&orderDirection=desc
```

**Query Parameters:**

- `skip` (optional): Number of records to skip (default: 0)
- `take` (optional): Number of records to return (default: 10, min: 1, max: 100)
- `orderBy` (optional): Field to sort by - `"dueDate"`, `"priorityScore"`, or `"createdAt"` (default: `"createdAt"`)
- `orderDirection` (optional): Sort direction - `"asc"` or `"desc"` (default: `"desc"`)
- `category` (optional): Filter by task category (e.g., `"work"`, `"personal"`)
- `priorityLevel` (optional): Filter by priority level (e.g., `"high"`, `"medium"`, `"low"`, `"critical"`)

**Tasks Service Response (HTTP 200):**

```json
{
  "tasksServiceRequestId": "a9b1a054-9626-41f2-8bb3-ab3f3cc50773",
  "tasks": [
    {
      "id": 1,
      "title": "Review And Approve Quarterly Budget Report",
      "dueDate": "2025-12-12T23:59:59.000Z",
      "category": "work",
      "priority": {
        "level": "high",
        "score": 8,
        "reason": "Task involves reviewing and approving a quarterly budget report with a deadline at the end of the week, indicating high priority and time sensitivity for work-related financial planning."
      },
      "createdAt": "2025-12-09T10:00:00.000Z",
      "updatedAt": "2025-12-09T10:00:00.000Z",
      "subtasks": [...]
    },
    {
      "id": 2,
      "title": "Prepare Client Meeting Presentation",
      "dueDate": "2025-12-15T00:00:00.000Z",
      "category": "work",
      "priority": {
        "level": "high",
        "score": 8,
        "reason": "Task involves preparing a presentation for a client meeting scheduled for next Monday, indicating high priority and urgency for work-related client engagement."
      },
      "createdAt": "2025-12-09T10:00:00.000Z",
      "updatedAt": "2025-12-09T10:00:00.000Z",
      "subtasks": [...]
    },
    {
      "id": 3,
      "title": "Update Project Documentation And Share With Team",
      "dueDate": null,
      "category": "work",
      "priority": {
        "level": "medium",
        "score": 5,
        "reason": "Task involves updating project documentation and sharing it with the team, indicating medium priority for work-related documentation maintenance."
      },
      "createdAt": "2025-12-09T10:00:00.000Z",
      "updatedAt": "2025-12-09T10:00:00.000Z",
      "subtasks": [...]
    },
    {
      "id": 4,
      "title": "Schedule Team Standup Meeting",
      "dueDate": "2025-12-10T09:00:00.000Z",
      "category": "work",
      "priority": {
        "level": "low",
        "score": 2,
        "reason": "Task involves scheduling a team standup meeting for tomorrow morning, indicating low priority for routine work-related meeting coordination."
      },
      "createdAt": "2025-12-09T10:00:00.000Z",
      "updatedAt": "2025-12-09T10:00:00.000Z",
      "subtasks": [...]
    },
    {
      "id": 5,
      "title": "Complete Code Review For Pull Request 123",
      "dueDate": "2025-12-12T23:59:59.000Z",
      "category": "work",
      "priority": {
        "level": "high",
        "score": 8,
        "reason": "Task involves completing a code review for pull request #123 with a deadline this Friday, indicating high priority and time sensitivity for work-related software development."
      },
      "createdAt": "2025-12-09T10:00:00.000Z",
      "updatedAt": "2025-12-09T10:00:00.000Z",
      "subtasks": [...]
    }
  ],
  "pagination": {
    "totalCount": 25,
    "skip": 0,
    "take": 5,
    "hasMore": true,
    "currentPage": 1,
    "totalPages": 5
  }
}
```

## Shared Library

The `backend/shared` package provides reusable components:

- **Clients**: Redis, Redlock, HTTP client, Prisma client
- **Middlewares**: Authentication, CORS, error handling, rate limiting, schema validation
- **Utilities**: Date/time helpers, retry logic, distributed locking, token bucket rate limiter
- **Error Classes**: Custom error types for consistent error handling
- **Types & Schemas**: Shared TypeScript types and Zod schemas

## Database Schema

The Tasks service uses PostgreSQL with Prisma ORM. The schema includes:

### Models

- **Task**: Stores task information including title, category, priority, due date, and natural language input
- **Subtask**: Stores subtasks associated with tasks, with ordering support

### Key Features

- User-based data isolation via `userId` fields
- Cascade deletion: Subtasks are automatically deleted when their parent task is deleted
- Unique ordering: Each task's subtasks have unique order values
- Indexed queries: Optimized indexes on `userId` and `taskId` for efficient lookups

See `backend/services/tasks/prisma/schema.prisma` for the complete schema definition.

### Seeding

The database can be seeded with sample data (25 tasks with subtasks) for testing and development:

```bash
cd backend/services/tasks
npm run prisma:seed
```

The seed file is located at `backend/services/tasks/prisma/seed.ts` and will automatically replace `@postgres:5432` with `@localhost:5432` when running locally. See `backend/services/tasks/prisma/README.md` for more details.

## Near-Term Enhancements

1. **OpenAI API Performance Monitoring**

   - Add Prometheus and Grafana services to Docker Compose for local monitoring
   - Instrument `executeParse` function with Prometheus metrics:
     - Success rate (track success and failure counts)
     - Duration metrics (average and P95, with P99 available if needed)
     - Total token usage (input and output tracked separately, average can be derived)
   - Expose `/metrics` endpoint in AI service for Prometheus scraping
   - Create Grafana dashboard with panels for request volume, success rate, duration metrics, and token usage
   - See `docs/plans/openai-api-monitoring.md` for detailed implementation plan

2. **Async AI Processing**

   - Add message queue (RabbitMQ) to infrastructure
   - Implement async job processing for AI requests
   - Return job ID immediately
   - Support webhook notifications when processing completes
