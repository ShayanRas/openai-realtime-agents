# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm i` - Install dependencies  
- `npm run dev` - Start development server (runs on http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Environment Setup
- Copy `.env.sample` to `.env` and add `OPENAI_API_KEY`
- Or add `OPENAI_API_KEY` to your shell profile

## Architecture Overview

This is a Next.js application demonstrating advanced voice agent patterns using the OpenAI Realtime API and OpenAI Agents SDK. The architecture supports two main agentic patterns:

### Core Structure
- **Next.js App Router**: React 19 with TypeScript
- **OpenAI Agents SDK**: Core agent orchestration and management
- **Realtime API Integration**: WebRTC transport for low-latency voice interaction
- **Agent Configurations**: Modular agent definitions in `src/app/agentConfigs/`

### Agent Patterns

1. **Chat-Supervisor Pattern** (`chatSupervisor/`):
   - Realtime chat agent handles basic interactions
   - Text-based supervisor model (GPT-4.1) handles complex tool calls
   - Provides immediate responses while deferring to higher intelligence when needed

2. **Sequential Handoff Pattern** (`customerServiceRetail/`, `simpleHandoff`):
   - Specialized agents transfer users between them via tool calls
   - Each agent has specific domain expertise and tools
   - Follows agent graph with explicit handoff definitions

### Key Components

- **Main App** (`src/app/App.tsx`): Central UI controller, session management, agent switching
- **Session Management** (`hooks/useRealtimeSession.ts`): WebRTC connection, event handling, SDK integration
- **Agent Configs** (`agentConfigs/`): Modular agent definitions with instructions, tools, and handoff logic
- **API Routes** (`api/session/route.ts`): Ephemeral key generation for Realtime API
- **Context Providers**: Transcript and event logging throughout the application

### Agent Configuration System

Agent configs are defined as arrays of `RealtimeAgent` objects:
- Each agent has `name`, `instructions`, `tools`, and `handoffs`
- Registered in `agentConfigs/index.ts` as `allAgentSets`
- Accessible via URL parameter `?agentConfig=<key>`
- Default scenario is `chatSupervisor`

### Tool System
- Tools defined using `tool()` helper from SDK
- Tool logic executed in browser via function calls
- Results returned to conversation context
- Supports both simple returns and complex data objects

### Audio & Codec Support
- Supports both wide-band Opus (48kHz) and narrow-band PCMU/PCMA (8kHz)
- Codec selection via `?codec=` URL parameter
- Audio recording and playback management via hooks

### Session Flow
1. Generate ephemeral key via `/api/session`
2. Initialize WebRTC connection with selected agent as root
3. Handle agent handoffs via tool calls and session updates
4. Manage transcript, events, and guardrails throughout session

### Adding New Agent Scenarios
1. Create new config in `agentConfigs/`
2. Define agents with instructions, tools, and handoffs
3. Add to `allAgentSets` in `agentConfigs/index.ts`
4. Accessible via scenario dropdown in UI


###COMMUNICATION GUIDELINES##
DO NOT BE A YES MAN. user doesn't need your affirmation. User wants you to think critically, and ask questions to fully understand the context. If user is being dumb, tell them. Don't make decisions on your own behalf, always confirm with user. 