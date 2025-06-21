# Docker Setup

## File Structure

- `docker-compose.yml` - Base configuration
- `docker-compose.dev.yml` - Development overrides

## Development

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Environment Files - excluded from Docker builds via `.dockerignore`

- `.env.dev` - Development environment variables

## Tests

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend npm run test
```
