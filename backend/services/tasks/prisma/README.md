# Prisma Seed

This directory contains the Prisma seed file that populates the database with 25 sample tasks and their subtasks.

## Usage

### After running migrations

The seed will automatically run after `prisma migrate dev` if you have the seed script configured in `package.json` (which is already set up).

### Manual execution

To run the seed manually:

```bash
npm run prisma:seed
```

Or using Prisma directly:

```bash
npx prisma db seed
```

## What gets seeded

- **25 tasks** with varied:

  - Categories: `work` (13 tasks) and `personal` (12 tasks)
  - Priority levels: `high`, `medium`, `low`, and `critical`
  - Priority scores: 2-10
  - Due dates: Some with dates, some without
  - Natural language descriptions
  - Parsed titles, categories, priorities, and reasons

- **~132 subtasks** distributed across the tasks (average ~5 subtasks per task)

## Important Notes

- The seed script **deletes all existing tasks for userId = 1** before seeding
- All tasks are created for `userId = 1`
- The seed uses the actual parsed data from the database (not natural language that needs AI parsing)
- This allows you to have test data immediately without requiring the AI service to be running

## Customization

To modify the seed data, edit `prisma/seed.ts` and update the `tasksData` array.
