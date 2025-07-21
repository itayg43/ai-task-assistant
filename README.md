## Development

Before starting make sure to set the required environment variables:

1. Navigate to the `backend/` directory
2. Create a `.env.dev` file
3. Copy the contents of `backend/.env.example` and fill in your local values

---

Build and run the application:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

(Optional) Typescript type checking:

1. Open a new terminal and connect to the running backend container:

```bash
docker exec -it <backend_container_id> sh
```

2. Inside the container, run:

```bash
npm run start:dev:type-check
```

This will continuously watch for typescript errors and report them instantly as you edit files.

(Optional) Connect to the running redis cli:

```bash
docker exec -it <redis_container_id> redis-cli
```

Run tests:

1. Open a new terminal and connect to the running backend container:

```bash
docker exec -it <backend_container_id> sh
```

2. Inside the container, run:

```bash
npm run test
```

_Alternatively, for a clean, one-off test run (useful for CI or to ensure a fresh environment):_

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend npm run test
```
