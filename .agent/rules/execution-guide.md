# Execution Guide (Cheat Sheet)

This guide provides the standard commands for development and verification. All commands must be run from the **project root**.

## 1. The Golden Rule: No Interactive Modes

Agents and CI processes **MUST NEVER** trigger "watch" or "interactive" modes. These commands hang the terminal and cause timeouts.

- **NEVER** run: `npm test`, `npm run type-check`
- **ALWAYS** use the `-- run` or `:ci` variants.

---

## 2. Fast Commands Reference

### Verifying Changes (The "Checklist")

Prior to submitting any change, run these three commands:

```bash
# 1. Run relevant tests
npm test -- run <path_to_test_file>

# 2. Performance/Logic check (if applicable)
npm run test:prompts  # AI Service
npm run test:db       # Tasks Service

# 3. Final type safety check
npm run type-check:ci
```

### Development Environment

```bash
# Start full stack (Docker + Postgres + RabbitMQ + Services)
npm run start:dev
```

### Running Tests (Vitest)

Always include `-- run` before the file path to disable watch mode.

```bash
# Run all tests once
npm test -- run

# Run a specific file once (Preferred)
npm test -- run backend/services/tasks/src/some-file.test.ts

# Run matching files
npm test -- run webhooks
```

### Type Checking

```bash
# One-off comprehensive check across all workspaces
npm run type-check:ci
```

---

## 3. Service Specific Commands

| Service    | Command                          | Purpose                                       |
| :--------- | :------------------------------- | :-------------------------------------------- |
| **AI**     | `npm run test:prompts`           | Runs prompt fidelity and quality tests        |
| **Tasks**  | `npm run test:db`                | Runs tests requiring a real database (Prisma) |
| **Shared** | `npm test -- run backend/shared` | Tests shared utilities and components         |

---

## 4. Troubleshooting

- **Prisma Failures**: If a test fails with "PrismaClient constructor" errors, ensure the `@clients/prisma` module is mocked in your test file setup.
- **Terminal Hanging**: If a command doesn't exit, you likely forgot the `-- run` flag for Vitest. Terminate the process and retry with the flag.
