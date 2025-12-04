#!/bin/sh
set -e

echo "Running Prisma migrations..."
npm run prisma:migrate:dev -w backend/services/tasks -- --name auto --skip-generate

echo "Starting development server..."
exec npm run start:dev -w backend/services/tasks

