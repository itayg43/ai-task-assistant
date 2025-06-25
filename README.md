# Docker Setup

## Development

Before starting make sure to set the required environment variables:

1. Navigate to the `backend/` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/.env.example` and fill in your local values

Build and run the container in development mode:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

Build and run tests in a new temporary container:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend npm run test
```
