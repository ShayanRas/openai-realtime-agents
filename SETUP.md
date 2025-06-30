# Setup Guide for Unified Chat/Voice Agent System

This guide will help you set up the unified agent system that supports both text chat and voice interactions.

## Local Development Setup

### Prerequisites
- Node.js 18+ 
- Docker and Docker Compose
- OpenAI API key

### 1. Environment Configuration
Copy the environment file and add your OpenAI API key:
```bash
cp .env.sample .env
```

Edit `.env` and add:
```
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realtime_agents
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. Database Setup
Start PostgreSQL with Docker Compose:
```bash
docker-compose up -d
```

Generate Prisma client and run migrations:
```bash
npx prisma migrate dev --name init
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Features

### Mode Toggle
- **Chat Mode**: Traditional text-based chat with multimodal support (image uploads)
- **Voice Mode**: Realtime voice interaction using OpenAI's Realtime API

### Chat Mode Features
- Text conversations with AI
- Image upload and analysis
- Thread management with sidebar
- Anonymous sessions with local persistence
- Message history stored in PostgreSQL

### Voice Mode Features
- Real-time voice conversations
- Agent handoffs between specialized agents
- WebRTC for low-latency audio
- Multiple codec support (Opus, PCMU, PCMA)

## Database Schema

The system uses PostgreSQL with the following tables:
- `Session`: Anonymous user sessions
- `Thread`: Conversation threads (chat or voice)
- `Message`: Individual messages with content and attachments
- `Attachment`: File uploads (images, documents)

## API Endpoints

### Chat API
- `GET /api/chat/threads` - List threads for session
- `POST /api/chat/threads` - Create new thread
- `GET /api/chat/messages` - Get messages for thread
- `POST /api/chat/messages` - Send message
- `POST /api/chat/completion` - Get AI response
- `POST /api/chat/upload` - Upload files

### Voice API
- `POST /api/session` - Generate ephemeral keys for Realtime API

## Deployment to Render

### Using Render Blueprint
1. Fork this repository
2. Connect your GitHub account to Render
3. Create a new Blueprint deployment
4. Point to your repository
5. Set environment variables:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_BASE_URL` (your Render app URL)

### Manual Deployment
1. Create a PostgreSQL database on Render
2. Create a web service with:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment variables as listed above

## Architecture

```
├── src/app/
│   ├── api/                    # API routes
│   │   ├── chat/              # Chat-specific endpoints
│   │   └── session/           # Voice session management
│   ├── chat/                  # Chat UI components
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── ThreadSidebar.tsx
│   ├── components/            # Shared components
│   │   └── ModeToggle.tsx
│   ├── lib/                   # Utilities
│   │   ├── prisma.ts          # Database client
│   │   └── chat-agents.ts     # Text agent system
│   └── App.tsx               # Main application
├── prisma/
│   └── schema.prisma         # Database schema
├── docker-compose.yml        # Local PostgreSQL setup
└── render.yaml              # Render deployment config
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in `.env`
- Run migrations: `npx prisma migrate dev`

### Voice Mode Not Working
- Verify OPENAI_API_KEY is valid
- Check browser microphone permissions
- Ensure HTTPS in production (required for WebRTC)

### Image Upload Issues
- Check file permissions in `public/uploads/`
- Verify file size limits (10MB max)
- Ensure proper MIME type validation