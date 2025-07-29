Typescript type checking:

1. Open a new terminal and connect to the running tasks container:

```bash
docker exec -it <tasks_container_id> sh
```

2. Inside the container, run:

```bash
npm run start:dev:type-check
```

This will continuously watch for typescript errors and report them instantly as you edit files.

---

Connect to the running redis:

```bash
docker exec -it <redis_container_id> redis-cli
```

---

Run the tests:

1. Open a new terminal and connect to the running tasks container:

```bash
docker exec -it <tasks_container_id> sh
```

2. Inside the container, run:

```bash
npm run test
```

_Alternatively, for a clean, one-off test run (useful for CI or to ensure a fresh environment):_

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm tasks npm run test
```
