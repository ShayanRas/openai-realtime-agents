# OpenAI Agents SDK Comprehensive Guide

This document provides an in-depth guide to the OpenAI Agents SDK for Voice Agents based on the official documentation and implementation patterns found in this codebase.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Transport Layer](#transport-layer)
- [Agent Configuration](#agent-configuration)
- [Tools and Function Calling](#tools-and-function-calling)
- [Agent Handoffs](#agent-handoffs)
- [Guardrails](#guardrails)
- [Session Management](#session-management)
- [Audio Handling](#audio-handling)
- [Implementation Patterns](#implementation-patterns)
- [Best Practices](#best-practices)

## Overview

Voice Agents are realtime speech-to-speech AI assistants built on the OpenAI Realtime API. They provide natural voice interactions without the traditional pipeline of speech-to-text → text processing → text-to-speech.

### Key Capabilities
- **Realtime Audio Processing**: Direct audio-to-audio without transcription overhead
- **Multi-Agent Orchestration**: Seamless handoffs between specialized agents
- **Tool Integration**: Custom function calling and external service integration
- **Guardrails**: Built-in safety and compliance monitoring
- **Cross-Platform**: Works in browsers and backend environments
- **Multiple Transport Options**: WebRTC and WebSocket support

### Primary Use Cases
- Customer support systems
- Mobile app voice interactions
- Voice chat applications
- Phone-based AI assistants

## Core Concepts

### Speech-to-Speech Models
The fundamental advantage of the OpenAI Realtime API is direct audio processing:
- **Traditional Pipeline**: Audio → Transcription → Text Processing → TTS → Audio
- **Realtime Pipeline**: Audio → Direct Model Processing → Audio

This eliminates latency and preserves nuances like tone, emotion, and natural speech patterns.

### Agent Types
The SDK supports different agent architectures:

1. **Simple Agents**: Direct conversation handlers
2. **Specialist Agents**: Domain-specific with handoff capabilities  
3. **Supervisor Agents**: Hybrid approach combining realtime + text-based intelligence

## Quick Start

### 1. Installation
```bash
npm install @openai/agents
```

### 2. Project Setup
Recommended frameworks:
```bash
# Vite (recommended for quick prototyping)
npm create vite@latest my-voice-agent --template vanilla-ts

# Next.js (recommended for production)
npx create-next-app@latest my-voice-agent --typescript
```

### 3. Generate Ephemeral Token
```bash
curl -X POST https://api.openai.com/v1/realtime/sessions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-realtime-preview-2025-06-03"}'
```

### 4. Basic Agent Creation
```typescript
import { RealtimeAgent } from '@openai/agents/realtime';

const agent = new RealtimeAgent({
  name: 'Assistant',
  voice: 'sage',
  instructions: 'You are a helpful assistant.',
  tools: [],
  handoffs: []
});
```

### 5. Session Management
```typescript
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';

const session = new RealtimeSession(agent, {
  transport: new OpenAIRealtimeWebRTC({
    audioElement: document.createElement('audio')
  }),
  model: 'gpt-4o-realtime-preview-2025-06-03',
  config: {
    inputAudioFormat: 'pcm16',
    outputAudioFormat: 'pcm16'
  }
});

await session.connect({ apiKey: ephemeralToken });
```

## Architecture

### Session Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    RealtimeSession                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────── │
│  │   RealtimeAgent │  │    Transport    │  │   Guardrails  │
│  │                 │  │   (WebRTC/WS)   │  │              │
│  │  - Instructions │  │  - Audio I/O    │  │  - Safety    │
│  │  - Tools        │  │  - Connection   │  │  - Compliance │
│  │  - Handoffs     │  │  - Events       │  │  - Filtering  │
│  └─────────────────┘  └─────────────────┘  └─────────────── │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow
```
User Audio Input → Transport → Realtime API → Agent Processing → Tools/Handoffs → Response → Transport → Audio Output
```

## Transport Layer

The SDK supports multiple transport mechanisms for different use cases:

### WebRTC Transport (Default)
Best for browser-based applications:
```typescript
import { OpenAIRealtimeWebRTC } from '@openai/agents/realtime';

const transport = new OpenAIRealtimeWebRTC({
  mediaStream: await navigator.mediaDevices.getUserMedia({ audio: true }),
  audioElement: document.createElement('audio'),
  changePeerConnection: async (pc) => {
    // Custom WebRTC configuration
    return pc;
  }
});
```

**Features:**
- Automatic microphone recording
- Built-in audio playback
- Low latency
- Browser optimized

### WebSocket Transport
Best for server-side applications:
```typescript
import { OpenAIRealtimeWebSocket } from '@openai/agents/realtime';

const transport = new OpenAIRealtimeWebSocket({
  // Manual audio handling required
});
```

**Features:**
- Server-side compatible
- Raw PCM16 audio handling
- Phone system integration
- Custom audio pipeline support

### Custom Transport
Implement your own transport layer:
```typescript
class CustomTransport implements RealtimeTransportLayer {
  // Implement required interface methods
  connect(url: string): Promise<void> { /* ... */ }
  sendEvent(event: any): void { /* ... */ }
  on(event: string, callback: Function): void { /* ... */ }
  close(): void { /* ... */ }
}
```

## Agent Configuration

### Basic Agent Structure
```typescript
const agent = new RealtimeAgent({
  name: 'unique-agent-name',
  voice: 'sage', // or 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  instructions: `
    # Personality and Tone
    You are a helpful customer service agent...
    
    # Instructions
    - Always be polite and professional
    - Ask clarifying questions when needed
    - Use tools to provide accurate information
  `,
  tools: [/* tool definitions */],
  handoffs: [/* other agents */],
  handoffDescription: 'Brief description for handoff context'
});
```

### Voice Options
- **alloy**: Neutral, balanced
- **echo**: Clear, professional  
- **fable**: Warm, expressive
- **nova**: Friendly, upbeat
- **onyx**: Deep, confident
- **sage**: Wise, measured
- **shimmer**: Bright, energetic

### Instructions Best Practices
1. **Structure your prompt**: Use clear sections (Personality, Instructions, Examples)
2. **Define personality**: Specify tone, formality level, enthusiasm
3. **Provide examples**: Show desired response patterns
4. **Set boundaries**: Clearly define what the agent can/cannot do
5. **Include filler phrases**: Help manage user expectations during processing

## Tools and Function Calling

### Tool Definition
```typescript
import { tool } from '@openai/agents/realtime';

const getWeather = tool({
  name: 'getWeather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or coordinates'
      }
    },
    required: ['location']
  },
  execute: async (params) => {
    const { location } = params;
    // Implement weather API call
    return {
      temperature: 72,
      condition: 'sunny',
      location
    };
  }
});
```

### Tool Integration
```typescript
const agent = new RealtimeAgent({
  name: 'weather-agent',
  instructions: 'You help users get weather information.',
  tools: [getWeather]
});
```

### Advanced Tool Patterns

#### Tool with Conversation History
```typescript
const contextualTool = tool({
  name: 'analyzeConversation',
  description: 'Analyze the conversation context',
  execute: async (params, context) => {
    const history = context.getHistory();
    // Process conversation history
    return analysis;
  }
});
```

#### Tool Approval Workflow
```typescript
const approvalTool = tool({
  name: 'sensitiveAction',
  description: 'Perform sensitive operation',
  requiresApproval: true,
  execute: async (params) => {
    // Will be called only after user approval
    return result;
  }
});
```

## Agent Handoffs

Handoffs enable seamless transitions between specialized agents:

### Simple Handoff
```typescript
const greeterAgent = new RealtimeAgent({
  name: 'greeter',
  instructions: 'Greet users and route them appropriately',
  handoffs: [specialistAgent] // Can hand off to specialist
});

const specialistAgent = new RealtimeAgent({
  name: 'specialist',
  instructions: 'Handle specialized requests',
  handoffs: [] // Terminal agent
});
```

### Complex Agent Networks
```typescript
// Bidirectional handoffs
authAgent.handoffs.push(salesAgent, returnsAgent, humanAgent);
salesAgent.handoffs.push(authAgent, returnsAgent, humanAgent);
returnsAgent.handoffs.push(authAgent, salesAgent, humanAgent);
```

### Handoff Execution
Handoffs are triggered automatically when agents determine a transfer is needed:
```typescript
// In agent instructions:
"If the user wants to make a purchase, transfer to the 'sales' agent"
```

## Guardrails

Guardrails monitor and filter agent responses for safety and compliance:

### Basic Guardrail
```typescript
const moderationGuardrail = {
  name: 'content-moderation',
  description: 'Filter inappropriate content',
  execute: async (message) => {
    const isSafe = await moderateContent(message);
    return {
      allowed: isSafe,
      reason: isSafe ? null : 'Content policy violation'
    };
  }
};
```

### Session Integration
```typescript
const session = new RealtimeSession(agent, {
  // ... other config
  outputGuardrails: [moderationGuardrail]
});
```

### Custom Guardrails
```typescript
const complianceGuardrail = {
  name: 'industry-compliance',
  execute: async (message, context) => {
    // Check against industry-specific rules
    const violations = await checkCompliance(message);
    return {
      allowed: violations.length === 0,
      reason: violations.join(', '),
      modifiedMessage: sanitizeMessage(message)
    };
  }
};
```

## Session Management

### Session Configuration
```typescript
const session = new RealtimeSession(rootAgent, {
  transport: transportLayer,
  model: 'gpt-4o-realtime-preview-2025-06-03',
  config: {
    inputAudioFormat: 'pcm16',
    outputAudioFormat: 'pcm16',
    inputAudioTranscription: {
      model: 'gpt-4o-mini-transcribe'
    },
    turnDetection: {
      type: 'server_vad',
      threshold: 0.9,
      prefixPaddingMs: 300,
      silenceDurationMs: 500
    }
  },
  outputGuardrails: [/* guardrails */],
  context: {
    /* custom context data */
  }
});
```

### Session Events
```typescript
session.on('connected', () => {
  console.log('Session connected');
});

session.on('agent_handoff', (agentName) => {
  console.log(`Handed off to: ${agentName}`);
});

session.on('agent_tool_start', (toolCall) => {
  console.log(`Tool called: ${toolCall.name}`);
});

session.on('guardrail_tripped', (violation) => {
  console.log(`Guardrail triggered: ${violation.reason}`);
});

session.on('error', (error) => {
  console.error('Session error:', error);
});
```

## Audio Handling

### Audio Formats
Supported formats:
- **pcm16**: 16-bit PCM, recommended for quality
- **g711_ulaw**: 8-bit μ-law, for telephony systems
- **g711_alaw**: 8-bit A-law, for telephony systems

### Turn Detection
```typescript
// Server-side Voice Activity Detection (recommended)
turnDetection: {
  type: 'server_vad',
  threshold: 0.9,        // Sensitivity (0.0-1.0)
  prefixPaddingMs: 300,  // Audio before speech
  silenceDurationMs: 500 // Silence before turn end
}

// No turn detection (Push-to-Talk)
turnDetection: null
```

### Audio Control
```typescript
// Interrupt current response
session.interrupt();

// Mute/unmute output
session.mute(true);  // Mute
session.mute(false); // Unmute

// Send text instead of audio
session.sendMessage("Hello, this is text input");
```

## Implementation Patterns

### Pattern 1: Simple Agent
Best for straightforward conversational interfaces:
```typescript
const chatAgent = new RealtimeAgent({
  name: 'chat',
  instructions: 'You are a friendly assistant',
  tools: [basicTools]
});
```

### Pattern 2: Multi-Agent Handoff
Best for complex workflows with specialist domains:
```typescript
const agentNetwork = [authAgent, salesAgent, supportAgent];
// Set up bidirectional handoffs between all agents
```

### Pattern 3: Supervisor Pattern
Best for maintaining conversation continuity while leveraging high intelligence:
```typescript
const chatAgent = new RealtimeAgent({
  name: 'chat',
  instructions: 'Handle basic tasks, delegate complex ones',
  tools: [delegateToSupervisor] // Calls GPT-4 for complex tasks
});
```

### Pattern 4: Hybrid Voice/Text
Combine realtime agents with traditional text-based AI:
```typescript
const hybridTool = tool({
  name: 'complexReasoning',
  execute: async (params) => {
    // Call text-based model for complex reasoning
    const result = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: conversationHistory
    });
    return result.choices[0].message.content;
  }
});
```

## Best Practices

### Performance
1. **Use appropriate models**: Realtime-mini for simple tasks, full realtime for complex
2. **Optimize tool execution**: Keep tool responses fast and concise
3. **Minimize handoffs**: Only transfer when necessary
4. **Cache when possible**: Store frequently accessed data

### User Experience
1. **Provide immediate feedback**: Let users know you're processing
2. **Use filler phrases**: "Let me check that for you"
3. **Confirm important information**: Read back phone numbers, addresses
4. **Handle interruptions gracefully**: Support natural conversation flow

### Security
1. **Validate all inputs**: Never trust user-provided data
2. **Use ephemeral tokens**: Generate short-lived client tokens
3. **Implement guardrails**: Monitor for inappropriate content
4. **Sanitize outputs**: Filter sensitive information

### Development
1. **Structure prompts clearly**: Use sections and examples
2. **Test thoroughly**: Verify tool execution and handoffs
3. **Monitor conversations**: Log interactions for improvement
4. **Handle errors gracefully**: Provide fallback responses

### Prompt Engineering
1. **Be specific about personality**: Define tone, formality, enthusiasm
2. **Provide clear examples**: Show desired interaction patterns
3. **Set explicit boundaries**: Define what agent can/cannot do
4. **Use conversation states**: Structure complex flows as state machines

### Error Handling
```typescript
session.on('error', (error) => {
  console.error('Session error:', error);
  // Implement fallback logic
  await reconnectSession();
});

// Tool error handling
const robustTool = tool({
  name: 'apiCall',
  execute: async (params) => {
    try {
      return await externalAPI(params);
    } catch (error) {
      return {
        error: 'Service temporarily unavailable',
        fallback: 'Please try again later'
      };
    }
  }
});
```

## Conclusion

The OpenAI Agents SDK provides a powerful framework for building sophisticated voice interactions. By leveraging speech-to-speech models, multi-agent orchestration, and extensive customization options, developers can create natural, efficient voice applications that go far beyond traditional chatbots.

Key takeaways:
- Start with simple agents and gradually add complexity
- Use the right transport layer for your deployment environment
- Implement proper error handling and guardrails
- Test thoroughly with real users
- Monitor and iterate based on conversation analytics

For the most up-to-date information, always refer to the [official OpenAI Agents SDK documentation](https://openai.github.io/openai-agents-js/).