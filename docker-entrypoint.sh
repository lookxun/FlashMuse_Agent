#!/bin/sh
set -e
echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy
echo "[entrypoint] starting Next.js..."
exec npm run start
