#!/bin/sh
set -e
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy
echo "[entrypoint] Migration complete. Starting service..."
exec "$@"
