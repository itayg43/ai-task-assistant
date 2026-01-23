# Execution Guide

This guide defines the standard commands for running the application, tests, and type checks. Use these commands to ensure consistency and avoid common errors.

## Working Directory

Always execute these commands from the **project root directory**.

## Running the Application

To start the full development environment with Docker and hot-reloading:

```bash
npm run start:dev
```

## Running Tests

This project uses **Vitest**.

- **Run All Tests**:
  - Interactive (Watch Mode):
    ```bash
    npm test
    ```
  - Single Run (CI / Agents):
    ```bash
    npm test -- run
    ```

- **Run Specific Tests**:
  You can pass arguments to Vitest directly:

  ```bash
  npm test src/path/to/test.ts
  ```

- **AI Service Prompt Tests**:

  ```bash
  npm run test:prompts
  ```

- **Tasks Service Database Tests**:
  ```bash
  npm run test:db
  ```

## Type Checking

To verify TypeScript types across all workspaces (`backend/shared`, `backend/services/ai`, `backend/services/tasks`).

- **One-off Check (Recommended for Agents)**:
  Use this for verification steps to ensure the command exits upon completion.

  ```bash
  npm run type-check:ci
  ```

- **Watch Mode**:
  Runs type checking in parallel and watches for changes.
  ```bash
  npm run type-check
  ```
