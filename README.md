# Docker Setup

## Development

Before starting make sure to set the required environment variables:

1. Navigate to the `backend/` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/.env.example` and fill in your local values

> **⚠️ Note:**
> If you set a port in your `.env.dev` file that is different from `3001`, you must also update the port in both `backend/Dockerfile.dev` and `docker-compose.dev.yml`.

Build and run the application:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

Build and run the tests:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend npm run test
```
