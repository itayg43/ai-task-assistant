# AI Task Assistant

A microservices-based system that leverages OpenAI to parse natural language task descriptions into structured, actionable data with priority scoring, categorization, and subtask generation.

## Overview

### Architecture

```mermaid
graph LR
    Client[Client] -->|HTTP Request| Tasks[Tasks Service<br/>Port 3001]
    Tasks -->|Rate Limit Check| Redis[Redis<br/>Token Bucket<br/>Rate Limiting]
    Redis -->|Allow/Deny| Tasks
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
- **Distributed Rate Limiting**: Token bucket algorithm with Redis and Redlock
- **Type Safety**: TypeScript and Zod schemas throughout the stack

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **AI**: OpenAI API
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
   # AI Service
   cd backend/services/ai
   cp .env.example .env.dev
   # Edit .env.dev with your OpenAI API key
   cp .env.example .env.test
   # Edit .env.test with your OpenAI API key for prompt evaluation tests

   # Tasks Service
   cd backend/services/tasks
   cp .env.example .env.dev
   # Edit .env.dev with service configuration
   ```

4. **Start services**

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
   ```

   Services will be available at:

   - **Tasks Service**: `http://localhost:3001`
   - **AI Service**: `http://localhost:3002`
   - **Redis**: `localhost:6379`

### Additional Commands

```bash
# Type checking (runs in watch mode for all workspaces)
npm run type-check

# Access Redis CLI
docker exec -it <redis_container_id> redis-cli

# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f tasks
```

### Running Tests

```bash
# Run all tests
npm test

# Run prompt evaluation tests (requires .env.test)
npm run test:prompts

# Run tests for specific workspace
npm test -w backend/services/ai
npm test -w backend/services/tasks
npm test -w backend/shared
```

## API Examples

### Success Case

**1. Client Request to Tasks Service:**

```http
POST /create

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
    "dueDate": "2025-12-26T20:33:11.049Z",
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
  "tasksServiceRequestId": "7fcc9514-4db5-435c-948b-0127b374f435",
  "title": "Plan Company-Wide Team Building Event",
  "dueDate": "2025-12-26T20:33:11.049Z",
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
}
```

### Vague Input Error

When input is too vague, the system provides helpful suggestions:

**1. Client Request to Tasks Service:**

```http
POST /create

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

### OpenAI API Error

When the OpenAI API encounters an error, the system handles it gracefully:

**1. Client Request to Tasks Service:**

```http
POST /create

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

## Shared Library

The `backend/shared` package provides reusable components:

- **Clients**: Redis, Redlock, HTTP client
- **Middlewares**: Authentication, CORS, error handling, rate limiting, schema validation
- **Utilities**: Date/time helpers, retry logic, distributed locking, token bucket rate limiter
- **Error Classes**: Custom error types for consistent error handling
- **Types & Schemas**: Shared TypeScript types and Zod schemas

## Future Plans

### Near-Term Enhancements

1. **Token Bucket Rate Limiter Refactoring**

   - Verify we get the requestId from `res` and add it to `logContext` in `create-token-bucket-rate-limiter.ts`
   - Refactor rate limiter to throw errors instead of returning 429 directly, allowing the error handler to properly format responses with requestId
   - Delete `TokenBucketRateLimiterServiceError` and replace it with a general error class with 503 status code
   - Update tests in `create-token-bucket-rate-limiter.test.ts` and `tasks-controller.integration.test.ts` to reflect the new error-throwing behavior (429 should now be thrown as an error instead of returned directly, and TokenBucketRateLimiterServiceError references should be updated to the new general error class)

2. **PostgreSQL Integration**

   - Add PostgreSQL service to Docker Compose
   - Implement Prisma ORM with schema and migrations
   - Create CRUD operations for tasks in Tasks service

3. **Token Usage Rate Limiting**

   - Implement rate limiting on `/tasks` create route based on OpenAI token usage
   - Track token consumption per request using AI service response metadata
   - Store token usage in Redis with distributed locking (Redlock) to prevent race conditions
   - Configure per-user token limits (e.g., 10,000 tokens per hour)

4. **Async AI Processing**

   - Add message queue (RabbitMQ) to infrastructure
   - Implement async job processing for AI requests
   - Return job ID immediately
   - Support webhook notifications when processing completes
