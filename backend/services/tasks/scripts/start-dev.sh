#!/bin/sh
set -e

cd backend/services/tasks

echo "Applying Prisma migrations..."
# Apply pending migrations.
# We use '|| true' to prevent the script from failing when there are no migrations to apply.
npx prisma migrate deploy || true

echo "Generating Prisma client..."
npx prisma generate

echo "Starting development server..."
exec npm run start:dev
