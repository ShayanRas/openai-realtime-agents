// Database types (extending Prisma generated types)
export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  threads?: Thread[];
}

export interface Thread {
  id: string;
  sessionId: string;
  mode: 'CHAT' | 'VOICE';
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
}

export interface Message {
  id: string;
  threadId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'MULTIMODAL';
  externalId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  type: string;
  url: string;
  filename?: string | null;
  size?: number | null;
  mimeType?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ThreadsResponse extends ApiResponse {
  data: {
    threads: Thread[];
  };
}

export interface MessagesResponse extends ApiResponse {
  data: {
    messages: Message[];
  };
}

export interface CreateThreadRequest {
  title?: string;
  firstMessage?: string;
}

export interface CreateMessageRequest {
  threadId: string;
  content: string;
  role?: 'USER' | 'ASSISTANT' | 'SYSTEM';
  contentType?: 'TEXT' | 'IMAGE' | 'MULTIMODAL';
  attachments?: Omit<Attachment, 'id' | 'messageId' | 'createdAt'>[];
}

export interface ChatCompletionRequest {
  threadId: string;
  message: string;
  attachments?: FileUpload[];
}

export interface FileUpload {
  type: string;
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export interface UploadResponse extends ApiResponse {
  data: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    detectedExtension: string;
  };
}

// UI Component types
export interface ChatInterfaceProps {
  initialSessionId?: string;
}

export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export interface MessageInputProps {
  onSendMessage: (content: string, attachments: FileUpload[]) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

export interface ThreadSidebarProps {
  threads: Thread[];
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => Promise<void>;
  isOpen: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export interface ModeToggleProps {
  currentMode: 'chat' | 'voice';
  onModeChange: (mode: 'chat' | 'voice') => void;
}

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Session status for voice mode
export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

// Chat agent types
export interface ChatAgentResponse {
  content: string;
  role: 'ASSISTANT';
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

// File validation types
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedType?: {
    mime: string;
    ext: string;
  };
}

// Environment types
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  OPENAI_API_KEY: string;
  DATABASE_URL: string;
  NEXT_PUBLIC_BASE_URL?: string;
}