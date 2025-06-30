import { useCallback, useRef, useState, useEffect } from 'react';
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import type { RealtimeAgent } from '@openai/agents/realtime';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useEvent } from '@/app/contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { applyCodecPreferences, audioFormatForCodec } from '@/app/lib/codecUtils';
import { chatSupervisorScenario, chatSupervisorCompanyName } from '@/app/agentConfigs/chatSupervisor';
import { createModerationGuardrail } from '@/app/agentConfigs/guardrails';
import { v4 as uuidv4 } from 'uuid';

type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

interface UseUnifiedSessionOptions {
  onTranscriptionComplete?: (itemId: string, text: string, role: 'user' | 'assistant') => void;
  onTranscriptionDelta?: (itemId: string, delta: string, role: 'user' | 'assistant') => void;
  onTranscriptionStart?: (itemId: string, role: 'user' | 'assistant') => void;
  onStatusChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
  onSpeechStarted?: (role: 'user' | 'assistant') => void;
  onSpeechStopped?: (role: 'user' | 'assistant') => void;
}

export function useUnifiedSession(options: UseUnifiedSessionOptions = {}) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('DISCONNECTED');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState(false);
  
  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  const { addTranscriptMessage, updateTranscriptMessage, addTranscriptBreadcrumb, updateTranscriptItem } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const historyHandlers = useHandleSessionHistory();

  // Transport event handler (similar to debug mode)
  const handleTransportEvent = (event: any) => {
    const eventType = event.type;
    console.log('[Transport Event]', eventType, event);
    
    switch (eventType) {
      case "input_audio_buffer.speech_started": {
        console.log('[User Speech Started]', event);
        options.onSpeechStarted?.('user');
        break;
      }
      case "input_audio_buffer.speech_stopped": {
        console.log('[User Speech Stopped]', event);
        options.onSpeechStopped?.('user');
        break;
      }
      case "response.created": {
        console.log('[Response Created]', event);
        // Assistant is about to speak
        options.onSpeechStarted?.('assistant');
        break;
      }
      case "response.done": {
        console.log('[Response Done]', event);
        options.onSpeechStopped?.('assistant');
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        console.log('[User Transcription Complete]', event);
        historyHandlers.current.handleTranscriptionCompleted(event);
        const { item_id, transcript } = event;
        if (item_id && transcript) {
          options.onTranscriptionComplete?.(item_id, transcript, 'user');
        }
        break;
      }
      case "response.audio_transcript.done": {
        console.log('[Assistant Transcription Complete]', event);
        historyHandlers.current.handleTranscriptionCompleted(event);
        const { item_id, transcript } = event;
        if (item_id && transcript) {
          options.onTranscriptionComplete?.(item_id, transcript, 'assistant');
        }
        break;
      }
      case "response.audio_transcript.delta": {
        console.log('[Assistant Transcription Delta]', event);
        historyHandlers.current.handleTranscriptionDelta(event);
        const { item_id, delta } = event;
        if (item_id && delta) {
          options.onTranscriptionDelta?.(item_id, delta, 'assistant');
        }
        break;
      }
      case "conversation.item.created": {
        console.log('[Conversation Item Created]', event);
        // Handle new conversation items
        if (event.item && event.item.type === 'message') {
          const { id, role } = event.item;
          if (id && role && (role === 'user' || role === 'assistant')) {
            options.onTranscriptionStart?.(id, role);
          }
        }
        break;
      }
      default: {
        logServerEvent(event);
        break;
      }
    }
  };

  // Agent handoff handler
  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    options.onAgentHandoff?.(agentName);
  };

  // History added handler - notify when new messages start
  const handleHistoryAdded = (item: any) => {
    console.log('[History Added]', item);
    // Call the default handler
    historyHandlers.current.handleHistoryAdded(item);
    
    // Also notify our callback for database persistence
    if (item && item.type === 'message') {
      const { itemId, role } = item;
      if (itemId && role && (role === 'user' || role === 'assistant')) {
        console.log('[History Added - Starting Transcription]', { itemId, role });
        options.onTranscriptionStart?.(itemId, role);
      }
    }
  };

  const fetchEphemeralKey = async (): Promise<string | null> => {
    try {
      logClientEvent({ url: "/session" }, "fetch_session_token_request");
      const tokenResponse = await fetch('/api/session');
      const data = await tokenResponse.json();
      logServerEvent(data, "fetch_session_token_response");
      
      if (!data.client_secret?.value) {
        logClientEvent(data, "error.no_ephemeral_key");
        return null;
      }
      
      return data.client_secret.value;
    } catch (error) {
      console.error('Failed to fetch ephemeral key:', error);
      return null;
    }
  };

  const updateStatus = useCallback((status: SessionStatus) => {
    setSessionStatus(status);
    options.onStatusChange?.(status);
    logClientEvent({}, status);
  }, [options, logClientEvent]);

  // Send initial greeting message (like debug mode)
  const sendInitialGreeting = useCallback(() => {
    if (!sessionRef.current) return;
    
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", "hi", true);
    
    sessionRef.current.transport.sendEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
    });
    
    sessionRef.current.transport.sendEvent({ 
      type: 'response.create' 
    });
  }, [addTranscriptMessage]);

  // Update session for PTT mode
  const updateSession = useCallback((usePTT: boolean) => {
    if (!sessionRef.current) return;
    
    const turnDetection = usePTT
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    sessionRef.current.transport.sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });
  }, []);

  // Connect to voice session (simplified, following debug mode pattern)
  const connect = useCallback(async () => {
    if (sessionRef.current || sessionStatus !== 'DISCONNECTED') return;

    updateStatus('CONNECTING');

    try {
      // Create audio element if it doesn't exist
      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement('audio');
        audioElementRef.current.autoplay = true;
        audioElementRef.current.style.display = 'none';
        document.body.appendChild(audioElementRef.current);
      }

      const ephemeralKey = await fetchEphemeralKey();
      if (!ephemeralKey) {
        updateStatus('DISCONNECTED');
        return;
      }

      // Use chat supervisor scenario for voice mode
      const agents = [...chatSupervisorScenario];
      const rootAgent = agents[0];
      const companyName = chatSupervisorCompanyName;
      const guardrail = createModerationGuardrail(companyName);

      // Set up audio format (default to opus)
      const audioFormat = audioFormatForCodec('opus');

      // Create realtime session with WebRTC transport
      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement: audioElementRef.current!,
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodecPreferences(pc, 'opus');
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
        outputGuardrails: [guardrail],
        context: {
          addTranscriptBreadcrumb,
        },
      });

      // Set up event listeners
      sessionRef.current.on("error", (...args: any[]) => {
        logServerEvent({
          type: "error",
          message: args[0],
        });
      });

      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.current.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.current.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.current.handleHistoryUpdated);
      sessionRef.current.on("history_added", handleHistoryAdded);
      sessionRef.current.on("guardrail_tripped", historyHandlers.current.handleGuardrailTripped);
      sessionRef.current.on("transport_event", handleTransportEvent);

      // Connect the session
      await sessionRef.current.connect({ apiKey: ephemeralKey });
      updateStatus('CONNECTED');

      // Update session with current PTT state
      updateSession(isPTTActive);

      // Send initial greeting (like debug mode)
      setTimeout(() => {
        sendInitialGreeting();
      }, 500);

    } catch (error) {
      console.error('Failed to connect voice session:', error);
      updateStatus('DISCONNECTED');
    }
  }, [sessionStatus, isPTTActive, updateStatus, fetchEphemeralKey, sendInitialGreeting, updateSession, logServerEvent, addTranscriptBreadcrumb, handleAgentHandoff, handleTransportEvent, historyHandlers]);

  // Disconnect from voice session
  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    
    if (audioElementRef.current && audioElementRef.current.parentNode) {
      audioElementRef.current.parentNode.removeChild(audioElementRef.current);
      audioElementRef.current = null;
    }
    
    updateStatus('DISCONNECTED');
    setIsPTTUserSpeaking(false);
  }, [updateStatus]);

  // Toggle voice mode
  const toggleVoiceMode = useCallback(async (enabled: boolean) => {
    setIsVoiceMode(enabled);
    
    if (enabled) {
      await connect();
    } else {
      disconnect();
    }
  }, [connect, disconnect]);

  // Interrupt current response
  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);

  // Send text message in voice mode
  const sendUserText = useCallback((text: string) => {
    if (!sessionRef.current) return;
    sessionRef.current.sendMessage(text);
  }, []);

  // Send raw event
  const sendEvent = useCallback((event: any) => {
    sessionRef.current?.transport.sendEvent(event);
  }, []);

  // Mute/unmute audio output
  const mute = useCallback((muted: boolean) => {
    sessionRef.current?.mute(muted);
  }, []);

  // Update turn detection (PTT mode)
  const updateTurnDetection = useCallback((usePTT: boolean) => {
    setIsPTTActive(usePTT);
    updateSession(usePTT);
  }, [updateSession]);

  // Push-to-talk handlers
  const handlePTTStart = useCallback(() => {
    if (!sessionRef.current || !isPTTActive) return;
    setIsPTTUserSpeaking(true);
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, [isPTTActive]);

  const handlePTTEnd = useCallback(() => {
    if (!sessionRef.current || !isPTTActive || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, [isPTTActive, isPTTUserSpeaking]);

  return {
    // Session state
    sessionStatus,
    isVoiceMode,
    isConnected: sessionStatus === 'CONNECTED',
    isConnecting: sessionStatus === 'CONNECTING',
    isPTTActive,
    isPTTUserSpeaking,
    
    // Session control
    toggleVoiceMode,
    disconnect,
    
    // Voice control
    interrupt,
    mute,
    sendUserText,
    sendEvent,
    updateTurnDetection,
    handlePTTStart,
    handlePTTEnd,
  };
}