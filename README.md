# Task Assistant

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

3. **Set up environment variables**

   Each service has a `.env.example` file. Copy it to create your configuration files and fill in the values:

   ```bash
   # Root level
   cp .env.example .env

   # AI Service
   cd backend/services/ai
   cp .env.example .env.dev
   cp .env.example .env.test

   # Tasks Service
   cd backend/services/tasks
   cp .env.example .env.dev
   cp .env.example .env.test
   ```

   Then edit each file with your actual values (database credentials, API keys, etc.)

4. **Start services**

   ```bash
   npm run start:dev
   ```

   Services will be available at:
   - **Tasks Service**: `http://localhost:3001`
   - **AI Service**: `http://localhost:3002`
   - **Redis**: `localhost:6379`
   - **PostgreSQL**: `localhost:5432`
   - **Prometheus**: `http://localhost:9090`
   - **Grafana**: `http://localhost:3000`

### Additional Commands

```bash
# Type checking across all services (runs in watch mode)
npm run type-check

# Full type check across all services (one-time execution, ideal for CI)
npm run type-check:ci

# Prisma commands (from backend/services/tasks directory)
cd backend/services/tasks
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate:dev  # Run database migrations
npm run prisma:seed  # Seed database with sample data

# View logs
docker compose logs -f ai
docker compose logs -f ai-consumer
docker compose logs -f tasks
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

## Near-Term Enhancements

1. **Async AI Processing with RabbitMQ** 🔄 **IN-PROGRESS**

2. **Multi-Tenant Architecture**
   - **Data Model**:
     - `Account`: Represents organization/workspace (replaces previous Tenant model)
     - `User`: Team members within an account (role: owner, admin, member)
     - `Task`, `Subtask`: Automatically scoped by `accountId`
   - **Implementation**:
     - Add `accountId` to all data tables
     - Add composite indexes: `(accountId, userId)` for efficient queries
     - Middleware for automatic account context extraction from JWT
     - Query filtering: All queries automatically filtered by `accountId` for data isolation
   - **Security**:
     - Data isolation at query level (can't access other accounts' data)

3. **Load Balancing & Horizontal Scaling**
   - **Nginx Reverse Proxy**:
     - Route requests across multiple service instances
     - Load balancing algorithm: least_conn for optimal distribution
     - Health checks for automatic failover
   - **Multi-Instance Support**:
     - Docker Compose templating for N service instances
     - Dynamic instance registration with load balancer
     - Shared state via Redis (no instance affinity required)

## Future Changes

### Monitoring & Observability

1. **Metadata Expiration Metric**
   - **Context**: When webhook callbacks arrive after the 1-hour metadata TTL expires, we cannot reconcile token usage (tokens leak)
   - **Enhancement**: Add `recordMetadataNotFound()` metric to track how often this edge case occurs
   - **Location**: `backend/services/tasks/src/controllers/webhooks-controller/webhooks-controller.ts`
   - **Impact**: Better visibility into token leakage and webhook latency issues

## Known Issues

1. **Prisma Migrations Fail on First Run**
   - **Issue**: When running `npm run start:dev` for the first time, the tasks service attempts to run Prisma migrations before the PostgreSQL database is fully ready, resulting in:
     ```
     Error: P1001: Can't reach database server at `postgres:5432`
     ```
   - **Workaround**: Wait for the database to be ready, then restart the tasks service:
     ```bash
     docker-compose restart tasks
     ```
   - **Root Cause**: The tasks service starts immediately without waiting for the database to be fully initialized
   - **Potential Solutions**:
     - Add healthcheck to PostgreSQL service and use `depends_on` with condition
     - Add retry logic to the Prisma migration script
     - Use a wait script or tool like `wait-for-it` or `dockerize`
