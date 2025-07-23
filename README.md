## Development

---

Before starting make sure to set the required environment variables:

1. Navigate to the `backend/` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/.env.example` and fill in your local values

---

Build and run the application:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

For backend specific workflows (type checking, redis, tests), see [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md).
