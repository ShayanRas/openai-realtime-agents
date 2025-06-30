#!/bin/bash

echo "🚀 Starting Realtime Agents App..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until npx prisma db push --skip-generate 2>/dev/null; do
  echo "Database not ready, waiting 2 seconds..."
  sleep 2
done

echo "✅ Database is ready!"

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "🎯 Starting Next.js application..."
if [ "$NODE_ENV" = "production" ]; then
  npm run build
  npm start
else
  npm run dev
fi