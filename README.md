## Development

Before starting make sure to set the required environment variables for each service:

1. Navigate to the `backend/services/[ai, tasks]` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/services/[ai, tasks]/.env.example` and fill in your local values

---

Build and run the application:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

For ai service specific workflows (type checking, tests), see [backend/services/ai/DEVELOPMENT.md](backend/services/ai/DEVELOPMENT.md).
For tasks service specific workflows (type checking, redis, tests), see [backend/services/tasks/DEVELOPMENT.md](backend/services/tasks/DEVELOPMENT.md).
