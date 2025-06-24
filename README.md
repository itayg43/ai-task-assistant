# Docker Setup

## Development

### File Structure

- `docker-compose.yml` - Base configuration
- `docker-compose.dev.yml` - Development-specific overrides

### Prerequisites

Before building the Docker image, make sure to set environment variables for development:

1. Navigate to the `backend/` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/.env.example` and fill in your local values

Build and run the container in development mode:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

### Tests

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend npm run test
```
