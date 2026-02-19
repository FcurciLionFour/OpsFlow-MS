#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  npm run db:migrate:deploy
fi

echo "Starting API..."
exec node dist/main
