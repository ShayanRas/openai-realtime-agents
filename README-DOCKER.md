# 🚀 One-Command Docker Setup (Windows)

## Prerequisites
- Docker Desktop for Windows
- OpenAI API key

## Quick Start

### 1. **Setup Environment**
```bash
# Copy environment file
copy .env.sample .env

# Edit .env in your favorite editor and add your OpenAI API key:
# OPENAI_API_KEY=sk-...your-key-here...
```

### 2. **Run Everything**
```bash
# Start everything (database + app)
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

That's it! 🎉

- **App**: http://localhost:3000
- **Database**: PostgreSQL on localhost:5432

## What Happens Automatically

1. **PostgreSQL** starts up
2. **App container** builds and waits for database
3. **Database migrations** run automatically
4. **Next.js dev server** starts
5. **Hot reload** works with your local files

## Commands

### View logs:
```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just the database
docker-compose logs -f postgres
```

### Stop everything:
```bash
docker-compose down
```

### Reset database:
```bash
# Stop and remove volumes (deletes all data)
docker-compose down -v

# Start fresh
docker-compose up --build
```

### Access database directly:
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d realtime_agents
```

## Development Workflow

1. Make code changes in your editor
2. Hot reload automatically updates the app
3. Database changes persist between restarts
4. Access logs with `docker-compose logs -f app`

## Testing Features

### Chat Mode:
- Visit http://localhost:3000
- Click "Chat" mode
- Test text + image uploads

### Voice Mode:
- Click "Voice" mode  
- Allow microphone permissions
- Test voice interactions

## Troubleshooting

### App won't start:
```bash
# Check logs
docker-compose logs app

# Rebuild
docker-compose up --build
```

### Database issues:
```bash
# Reset database
docker-compose down -v
docker-compose up
```

### Port conflicts:
- Change ports in `docker-compose.yml` if 3000 or 5432 are in use

## File Structure
```
├── docker-compose.yml    # Everything runs here
├── Dockerfile           # App container
├── .env                 # Your config
└── scripts/
    └── start.bat        # Windows startup script
```

Everything runs in Docker - no need to install Node.js, PostgreSQL, or manage dependencies locally!