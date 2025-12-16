// MCP Server Transport Types
export type TransportType = "stdio" | "streamable-http" | "sse";

// MCP Server Configuration
export interface McpServerConfig {
  id: string;
  name: string;
  transport: TransportType;
  // For STDIO
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For HTTP/SSE
  url?: string;
  headers?: Record<string, string>;
}

// Connection Status
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// Server State
export interface McpServerState {
  config: McpServerConfig;
  status: ConnectionStatus;
  error?: string;
  tools?: ToolInfo[];
  prompts?: PromptInfo[];
  resources?: ResourceInfo[];
}

// Tool Info
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Prompt Info
export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// Resource Info
export interface ResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Tool Call Request/Response
export interface ToolCallRequest {
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Prompt Get Request/Response
export interface PromptGetRequest {
  serverId: string;
  promptName: string;
  arguments?: Record<string, string>;
}

export interface PromptGetResponse {
  description?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: string;
      text?: string;
    };
  }>;
}

// Resource Read Request/Response
export interface ResourceReadRequest {
  serverId: string;
  uri: string;
}

export interface ResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

