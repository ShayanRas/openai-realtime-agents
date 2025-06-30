@echo off
echo 🚀 Starting Realtime Agents App...

echo ⏳ Waiting for database to be ready...
:wait_for_db
npx prisma db push --skip-generate >nul 2>&1
if %errorlevel% neq 0 (
    echo Database not ready, waiting 2 seconds...
    timeout /t 2 /nobreak >nul
    goto wait_for_db
)

echo ✅ Database is ready!

echo 🔄 Running database migrations...
npx prisma migrate deploy

echo 🎯 Starting Next.js application...
if "%NODE_ENV%"=="production" (
    npm run build
    npm start
) else (
    npm run dev
)