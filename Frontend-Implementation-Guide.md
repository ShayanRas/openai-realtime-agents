# Frontend Implementation Guide: OpenAI Realtime Voice Agents

This guide provides a comprehensive analysis of the frontend implementation for building voice agent applications using the OpenAI Agents SDK and React/Next.js.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Session Management](#session-management)
- [State Management](#state-management)
- [UI Components](#ui-components)
- [Audio System](#audio-system)
- [API Integration](#api-integration)
- [Event Handling](#event-handling)
- [Type System](#type-system)
- [Development Patterns](#development-patterns)
- [Best Practices](#best-practices)

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + Next.js 15 with TypeScript
- **Voice SDK**: OpenAI Agents SDK (`@openai/agents/realtime`)
- **Transport**: WebRTC for browser-based voice communication
- **State Management**: React Context API with custom hooks
- **Styling**: Tailwind CSS
- **Audio**: Web Audio API + MediaStream API

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │     App     │  │  Contexts   │  │    Components       │  │
│  │   (Main)    │  │ Transcript  │  │ Transcript, Events  │  │
│  │             │  │   Event     │  │   BottomToolbar     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Hooks    │  │  SDK Layer  │  │    API Routes       │  │
│  │ useRealtime │  │ RealtimeSDK │  │ /api/session        │  │
│  │ useHistory  │  │  Transport  │  │ /api/responses      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Session Management

### Session Lifecycle (`App.tsx:41-551`)

The main App component orchestrates the entire session lifecycle:

```typescript
// Session states
type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED"

// Main connection flow
const connectToRealtime = async () => {
  setSessionStatus("CONNECTING");
  
  // 1. Get ephemeral token
  const EPHEMERAL_KEY = await fetchEphemeralKey();
  
  // 2. Configure agents and guardrails
  const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
  const guardrail = createModerationGuardrail(companyName);
  
  // 3. Connect via SDK
  await connect({
    getEphemeralKey: async () => EPHEMERAL_KEY,
    initialAgents: reorderedAgents,
    audioElement: sdkAudioElement,
    outputGuardrails: [guardrail],
    extraContext: { addTranscriptBreadcrumb },
  });
};
```

### URL-Based Agent Configuration (`App.tsx:136-151`)

The app uses URL parameters for agent scenario selection:
```typescript
useEffect(() => {
  let finalAgentConfig = searchParams.get("agentConfig");
  if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
    finalAgentConfig = defaultAgentSetKey;
    // Redirect to default if invalid
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", finalAgentConfig);
    window.location.replace(url.toString());
  }
}, [searchParams]);
```

### Ephemeral Token Management (`App.tsx:181-195`)

Security through short-lived tokens:
```typescript
const fetchEphemeralKey = async (): Promise<string | null> => {
  const tokenResponse = await fetch("/api/session");
  const data = await tokenResponse.json();
  
  if (!data.client_secret?.value) {
    console.error("No ephemeral key provided by the server");
    setSessionStatus("DISCONNECTED");
    return null;
  }
  
  return data.client_secret.value;
};
```

## State Management

### Context Architecture

The app uses two primary contexts for state management:

#### 1. TranscriptContext (`contexts/TranscriptContext.tsx`)

Manages conversation history and UI state:
```typescript
type TranscriptContextValue = {
  transcriptItems: TranscriptItem[];
  addTranscriptMessage: (itemId: string, role: "user" | "assistant", text: string) => void;
  updateTranscriptMessage: (itemId: string, text: string, isDelta: boolean) => void;
  addTranscriptBreadcrumb: (title: string, data?: Record<string, any>) => void;
  toggleTranscriptItemExpand: (itemId: string) => void;
  updateTranscriptItem: (itemId: string, updatedProperties: Partial<TranscriptItem>) => void;
};
```

**Key Features:**
- **Message Management**: Real-time message updates with delta streaming
- **Breadcrumbs**: Non-conversational events (tool calls, agent switches)
- **Expandable Items**: JSON data inspection for debugging
- **Guardrail Integration**: Safety violation display

#### 2. EventContext (`contexts/EventContext.tsx`)

Handles system event logging:
```typescript
type EventContextValue = {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logServerEvent: (eventObj: Record<string, any>, eventNameSuffix?: string) => void;
  logHistoryItem: (item: any) => void;
  toggleExpand: (id: number | string) => void;
};
```

**Event Types:**
- **Client Events**: User actions, button clicks, state changes
- **Server Events**: WebRTC events, API responses, errors
- **History Events**: Conversation flow, agent handoffs

### Real-Time State Updates

The system handles real-time updates through SDK event listeners:
```typescript
// Session event handling (useRealtimeSession.ts:88-109)
useEffect(() => {
  if (sessionRef.current) {
    sessionRef.current.on("agent_handoff", handleAgentHandoff);
    sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
    sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
    sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
    sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);
    sessionRef.current.on("transport_event", handleTransportEvent);
  }
}, [sessionRef.current]);
```

## UI Components

### Transcript Component (`components/Transcript.tsx`)

The main conversation interface with sophisticated features:

#### Message Display (`Transcript.tsx:120-163`)
```typescript
// Dynamic message styling based on role
const isUser = role === "user";
const containerClasses = `flex justify-end flex-col ${
  isUser ? "items-end" : "items-start"
}`;
const bubbleBase = `max-w-lg p-3 ${
  isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"
}`;

// Guardrail integration
{guardrailResult && (
  <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
    <GuardrailChip guardrailResult={guardrailResult} />
  </div>
)}
```

#### Breadcrumb System (`Transcript.tsx:164-196`)
Non-conversational events displayed with expandable JSON:
```typescript
if (type === "BREADCRUMB") {
  return (
    <div className="flex flex-col justify-start items-start text-gray-500 text-sm">
      <div
        className={`whitespace-pre-wrap flex items-center font-mono text-sm ${
          data ? "cursor-pointer" : ""
        }`}
        onClick={() => data && toggleTranscriptItemExpand(itemId)}
      >
        {data && <span className="text-gray-400 mr-1">▶</span>}
        {title}
      </div>
      {expanded && data && (
        <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

#### Text Input System (`Transcript.tsx:213-234`)
```typescript
<input
  type="text"
  value={userText}
  onChange={(e) => setUserText(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && canSend) {
      onSendMessage();
    }
  }}
  className="flex-1 px-4 py-2 focus:outline-none"
  placeholder="Type a message..."
/>
```

### Events Panel (`components/Events.tsx`)

Real-time system event logging with visual indicators:

#### Event Direction Indicators (`Events.tsx:17-21`)
```typescript
const getDirectionArrow = (direction: string) => {
  if (direction === "client") return { symbol: "▲", color: "#7f5af0" };
  if (direction === "server") return { symbol: "▼", color: "#2cb67d" };
  return { symbol: "•", color: "#555" };
};
```

#### Expandable Event Details (`Events.tsx:84-90`)
```typescript
{log.expanded && log.eventData && (
  <div className="text-gray-800 text-left">
    <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
      {JSON.stringify(log.eventData, null, 2)}
    </pre>
  </div>
)}
```

### Bottom Toolbar (`components/BottomToolbar.tsx`)

Control interface with multiple interaction modes:

#### Push-to-Talk Implementation (`BottomToolbar.tsx:71-100`)
```typescript
<input
  id="push-to-talk"
  type="checkbox"
  checked={isPTTActive}
  onChange={(e) => setIsPTTActive(e.target.checked)}
  disabled={!isConnected}
/>
<button
  onMouseDown={handleTalkButtonDown}
  onMouseUp={handleTalkButtonUp}
  onTouchStart={handleTalkButtonDown}  // Mobile support
  onTouchEnd={handleTalkButtonUp}
  disabled={!isPTTActive}
  className={isPTTUserSpeaking ? "bg-gray-300" : "bg-gray-200"}
>
  Talk
</button>
```

#### Codec Selection (`BottomToolbar.tsx:142-151`)
```typescript
<select value={codec} onChange={handleCodecChange}>
  <option value="opus">Opus (48 kHz)</option>
  <option value="pcmu">PCMU (8 kHz)</option>
  <option value="pcma">PCMA (8 kHz)</option>
</select>
```

## Audio System

### WebRTC Integration (`hooks/useRealtimeSession.ts`)

#### Transport Configuration (`useRealtimeSession.ts:131-150`)
```typescript
sessionRef.current = new RealtimeSession(rootAgent, {
  transport: new OpenAIRealtimeWebRTC({
    audioElement,
    changePeerConnection: async (pc: RTCPeerConnection) => {
      applyCodec(pc);  // Apply codec preferences
      return pc;
    },
  }),
  model: 'gpt-4o-realtime-preview-2025-06-03',
  config: {
    inputAudioFormat: audioFormat,
    outputAudioFormat: audioFormat,
    inputAudioTranscription: {
      model: 'gpt-4o-mini-transcribe',
    },
  },
});
```

#### Codec Management (`lib/codecUtils.ts`)

Dynamic codec selection for different use cases:
```typescript
export function audioFormatForCodec(codec: string): 'pcm16' | 'g711_ulaw' | 'g711_alaw' {
  let audioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw' = 'pcm16';
  if (typeof window !== 'undefined') {
    const c = codec.toLowerCase();
    if (c === 'pcmu') audioFormat = 'g711_ulaw';
    else if (c === 'pcma') audioFormat = 'g711_alaw';
  }
  return audioFormat;
}

export function applyCodecPreferences(pc: RTCPeerConnection, codec: string): void {
  const caps = RTCRtpSender.getCapabilities?.('audio');
  const pref = caps.codecs.find(
    (c: any) => c.mimeType.toLowerCase() === `audio/${codec.toLowerCase()}`
  );
  
  pc.getTransceivers()
    .filter((t) => t.sender && t.sender.track?.kind === 'audio')
    .forEach((t) => t.setCodecPreferences([pref]));
}
```

#### Turn Detection Management (`App.tsx:259-285`)
```typescript
const updateSession = (shouldTriggerResponse: boolean = false) => {
  const turnDetection = isPTTActive
    ? null  // Disable automatic turn detection
    : {
        type: 'server_vad',
        threshold: 0.9,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: true,
      };

  sendEvent({
    type: 'session.update',
    session: { turn_detection: turnDetection },
  });
};
```

#### Audio Recording and Playback (`hooks/useAudioDownload.ts`, `App.tsx:420-431`)
```typescript
useEffect(() => {
  if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
    const remoteStream = audioElementRef.current.srcObject as MediaStream;
    startRecording(remoteStream);  // Begin recording for download
  }
  
  return () => {
    stopRecording();  // Cleanup on disconnect
  };
}, [sessionStatus]);
```

### Audio Controls (`App.tsx:385-418`)

Mute/unmute with bandwidth optimization:
```typescript
useEffect(() => {
  if (audioElementRef.current) {
    if (isAudioPlaybackEnabled) {
      audioElementRef.current.muted = false;
      audioElementRef.current.play().catch((err) => {
        console.warn("Autoplay may be blocked by browser:", err);
      });
    } else {
      audioElementRef.current.muted = true;
      audioElementRef.current.pause();
    }
  }

  // Toggle server-side audio stream mute to save bandwidth
  try {
    mute(!isAudioPlaybackEnabled);
  } catch (err) {
    console.warn('Failed to toggle SDK mute', err);
  }
}, [isAudioPlaybackEnabled]);
```

## API Integration

### Session Token Endpoint (`api/session/route.ts`)

Secure ephemeral token generation:
```typescript
export async function GET() {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2025-06-03",
      }),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

### Supervisor API Proxy (`api/responses/route.ts`)

Handles supervisor agent calls:
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (body.text?.format?.type === 'json_schema') {
    return await structuredResponse(openai, body);
  } else {
    return await textResponse(openai, body);
  }
}

async function textResponse(openai: OpenAI, body: any) {
  const response = await openai.responses.create({
    ...body,
    stream: false,  // Force synchronous response
  });
  return NextResponse.json(response);
}
```

## Event Handling

### Session History Management (`hooks/useHandleSessionHistory.ts`)

Complex event processing system that bridges SDK events to UI state:

#### Message Processing (`useHandleSessionHistory.ts:88-126`)
```typescript
function handleHistoryAdded(item: any) {
  if (!item || item.type !== 'message') return;

  const { itemId, role, content = [] } = item;
  if (itemId && role) {
    const isUser = role === "user";
    let text = extractMessageText(content);

    if (isUser && !text) {
      text = "[Transcribing...]";  // Placeholder during transcription
    }

    // Handle guardrail messages
    const guardrailMessage = sketchilyDetectGuardrailMessage(text);
    if (guardrailMessage) {
      const failureDetails = JSON.parse(guardrailMessage);
      addTranscriptBreadcrumb('Output Guardrail Active', { details: failureDetails });
    } else {
      addTranscriptMessage(itemId, role, text);
    }
  }
}
```

#### Transcription Updates (`useHandleSessionHistory.ts:128-161`)
```typescript
function handleTranscriptionDelta(item: any) {
  const itemId = item.item_id;
  const deltaText = item.delta || "";
  if (itemId) {
    updateTranscriptMessage(itemId, deltaText, true);  // Append mode
  }
}

function handleTranscriptionCompleted(item: any) {
  const itemId = item.item_id;
  const finalTranscript = !item.transcript || item.transcript === "\n"
    ? "[inaudible]"
    : item.transcript;
    
  if (itemId) {
    updateTranscriptMessage(itemId, finalTranscript, false);  // Replace mode
    updateTranscriptItem(itemId, { status: 'DONE' });
  }
}
```

#### Tool Call Tracking (`useHandleSessionHistory.ts:70-86`)
```typescript
function handleAgentToolStart(details: any, _agent: any, functionCall: any) {
  const lastFunctionCall = extractFunctionCallByName(functionCall.name, details?.context?.history);
  const function_name = lastFunctionCall?.name;
  const function_args = lastFunctionCall?.arguments;

  addTranscriptBreadcrumb(`function call: ${function_name}`, function_args);    
}

function handleAgentToolEnd(details: any, _agent: any, _functionCall: any, result: any) {
  const lastFunctionCall = extractFunctionCallByName(_functionCall.name, details?.context?.history);
  addTranscriptBreadcrumb(
    `function call result: ${lastFunctionCall?.name}`,
    maybeParseJson(result)
  );
}
```

#### Guardrail Processing (`useHandleSessionHistory.ts:163-185`)
```typescript
function handleGuardrailTripped(details: any, _agent: any, guardrail: any) {
  const moderation = extractModeration(guardrail.result.output.outputInfo);
  logServerEvent({ type: 'guardrail_tripped', payload: moderation });

  const lastAssistant = extractLastAssistantMessage(details?.context?.history);
  
  if (lastAssistant && moderation) {
    const category = moderation.moderationCategory ?? 'NONE';
    const rationale = moderation.moderationRationale ?? '';
    const offendingText = moderation?.testText;

    updateTranscriptItem(lastAssistant.itemId, {
      guardrailResult: {
        status: 'DONE',
        category,
        rationale,
        testText: offendingText,
      },
    });
  }
}
```

## Type System

### Core Types (`types.ts`)

Comprehensive TypeScript definitions ensure type safety:

#### Session and Status Types
```typescript
export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export type ModerationCategory = "OFFENSIVE" | "OFF_BRAND" | "VIOLENCE" | "NONE";
```

#### Transcript System Types
```typescript
export interface TranscriptItem {
  itemId: string;
  type: "MESSAGE" | "BREADCRUMB";
  role?: "user" | "assistant";
  title?: string;
  data?: Record<string, any>;
  expanded: boolean;
  timestamp: string;
  createdAtMs: number;
  status: "IN_PROGRESS" | "DONE";
  isHidden: boolean;
  guardrailResult?: GuardrailResultType;
}

export interface GuardrailResultType {
  status: "IN_PROGRESS" | "DONE";
  testText?: string; 
  category?: ModerationCategory;
  rationale?: string;
}
```

#### Event Logging Types
```typescript
export interface LoggedEvent {
  id: number;
  direction: "client" | "server";
  expanded: boolean;
  timestamp: string;
  eventName: string;
  eventData: Record<string, any>;
}
```

#### Agent Configuration Types
```typescript
export interface AgentConfig {
  name: string;
  publicDescription: string;
  instructions: string;
  tools: Tool[];
  toolLogic?: Record<string, (args: any, transcriptLogsFiltered: TranscriptItem[]) => Promise<any>>;
  downstreamAgents?: AgentConfig[] | { name: string; publicDescription: string }[];
}
```

## Development Patterns

### Custom Hook Architecture

The codebase demonstrates sophisticated hook composition:

#### 1. SDK Integration Hook (`useRealtimeSession.ts`)
```typescript
export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  
  // Connection management
  const connect = useCallback(async ({ getEphemeralKey, initialAgents, ... }) => {
    // SDK session creation and connection
  }, [callbacks]);
  
  // Event handling setup
  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      // ... other event listeners
    }
  }, [sessionRef.current]);
  
  return {
    status, connect, disconnect, sendUserText, sendEvent, mute, interrupt,
  } as const;
}
```

#### 2. History Processing Hook (`useHandleSessionHistory.ts`)
```typescript
export function useHandleSessionHistory() {
  const { addTranscriptMessage, updateTranscriptMessage, ... } = useTranscript();
  const { logServerEvent } = useEvent();
  
  // Event handler functions...
  
  const handlersRef = useRef({
    handleAgentToolStart, handleAgentToolEnd, handleHistoryUpdated,
    handleHistoryAdded, handleTranscriptionDelta, handleTranscriptionCompleted,
    handleGuardrailTripped,
  });
  
  return handlersRef;
}
```

### Context Provider Pattern

Centralized state management with specialized contexts:

```typescript
export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  
  const addTranscriptMessage = useCallback((itemId, role, text, isHidden = false) => {
    setTranscriptItems((prev) => {
      if (prev.some((log) => log.itemId === itemId && log.type === "MESSAGE")) {
        console.warn(`Message already exists for itemId=${itemId}`);
        return prev;
      }
      
      const newItem: TranscriptItem = {
        itemId, type: "MESSAGE", role, title: text,
        expanded: false, timestamp: newTimestampPretty(),
        createdAtMs: Date.now(), status: "IN_PROGRESS", isHidden,
      };
      
      return [...prev, newItem];
    });
  }, []);
  
  return (
    <TranscriptContext.Provider value={{ transcriptItems, addTranscriptMessage, ... }}>
      {children}
    </TranscriptContext.Provider>
  );
};
```

### Error Handling Patterns

Comprehensive error boundaries and graceful degradation:

```typescript
// Session connection error handling
const connectToRealtime = async () => {
  try {
    const EPHEMERAL_KEY = await fetchEphemeralKey();
    if (!EPHEMERAL_KEY) return;
    
    await connect({ ... });
  } catch (err) {
    console.error("Error connecting via SDK:", err);
    setSessionStatus("DISCONNECTED");
  }
};

// Audio playback error handling
audioElementRef.current.play().catch((err) => {
  console.warn("Autoplay may be blocked by browser:", err);
});
```

### Ref Management for SDK Integration

Careful ref usage for SDK lifecycle management:
```typescript
const sessionRef = useRef<RealtimeSession | null>(null);
const audioElementRef = useRef<HTMLAudioElement | null>(null);

// SDK audio element creation
const sdkAudioElement = React.useMemo(() => {
  if (typeof window === 'undefined') return undefined;
  const el = document.createElement('audio');
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}, []);
```

## Best Practices

### 1. State Management
- **Separate Concerns**: Use specialized contexts for different data types
- **Immutable Updates**: Always use functional state updates
- **Ref for SDK Objects**: Use refs for objects that shouldn't trigger re-renders

### 2. Event Handling
- **Centralized Processing**: Use custom hooks to process complex event streams
- **Error Boundaries**: Implement graceful error handling for all async operations
- **Debouncing**: Consider debouncing for high-frequency events

### 3. Audio Management
- **Browser Compatibility**: Handle autoplay restrictions gracefully
- **Resource Cleanup**: Always clean up audio streams and connections
- **Codec Flexibility**: Support multiple codecs for different deployment scenarios

### 4. Performance Optimization
- **Memoization**: Use `useCallback` and `useMemo` for expensive operations
- **Lazy Loading**: Only load components when needed
- **Event Cleanup**: Remove event listeners in cleanup functions

### 5. Security
- **Ephemeral Tokens**: Use short-lived tokens for API access
- **Environment Variables**: Keep API keys on the server side
- **Input Validation**: Validate all user inputs before processing

### 6. User Experience
- **Loading States**: Provide clear feedback during connection states
- **Error Messages**: Display helpful error messages to users
- **Accessibility**: Ensure keyboard navigation and screen reader support

### 7. Development Workflow
- **TypeScript**: Leverage strong typing for better development experience
- **Component Composition**: Build reusable, composable components
- **Testing**: Implement comprehensive testing for complex state logic

## Conclusion

This frontend implementation demonstrates a production-ready approach to building voice agent applications with React and the OpenAI Agents SDK. Key architectural decisions include:

- **Separation of Concerns**: Clear boundaries between UI, state management, and SDK integration
- **Real-time Updates**: Sophisticated event handling for seamless user experience
- **Audio Pipeline**: Flexible audio handling supporting multiple deployment scenarios
- **Type Safety**: Comprehensive TypeScript usage for maintainable code
- **Error Resilience**: Graceful error handling and recovery mechanisms

The codebase provides a solid foundation for building sophisticated voice agent interfaces that can scale to production requirements while maintaining code quality and developer experience.