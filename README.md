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
```

**Important Notes for `npm run test:db`:**

- The test database should be separate from development database
- The `test:db` script automatically resets the test database before running
- Tests run sequentially to avoid race conditions with shared database state
- Ensure PostgreSQL is running and accessible before running tests
- The test suite will clean up data after each test, but uses a real database connection

## Project Status

For current development status, open issues, code quality improvements, and planned features, see **[STATUS.md](STATUS.md)**.
