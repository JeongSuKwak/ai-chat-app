import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type {
  McpServerConfig,
  McpServerState,
  ConnectionStatus,
  ToolInfo,
  PromptInfo,
  ResourceInfo,
  ToolCallResponse,
  PromptGetResponse,
  ResourceReadResponse,
} from "./types";

type TransportType = StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;

interface ConnectedClient {
  client: Client;
  transport: TransportType;
  config: McpServerConfig;
}

interface GlobalMcpState {
  clients: Map<string, ConnectedClient>;
  states: Map<string, McpServerState>;
}

// Extend global type for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __mcpGlobalState: GlobalMcpState | undefined;
}

/**
 * Get or initialize global MCP state
 * Uses Node.js global object to persist connections across Next.js API routes
 */
function getGlobalState(): GlobalMcpState {
  if (!global.__mcpGlobalState) {
    global.__mcpGlobalState = {
      clients: new Map(),
      states: new Map(),
    };
  }
  return global.__mcpGlobalState;
}

/**
 * Global MCP Client Manager
 * Manages MCP server connections using Node.js global object
 * This ensures connections persist across API route invocations
 */
export class GlobalMcpClientManager {
  private globalState: GlobalMcpState;

  constructor() {
    this.globalState = getGlobalState();
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: McpServerConfig): Promise<McpServerState> {
    // If already connected, return existing state
    if (this.globalState.clients.has(config.id)) {
      const existingState = this.globalState.states.get(config.id);
      if (existingState?.status === "connected") {
        console.log(`[GlobalMCP] Server ${config.name} already connected`);
        return existingState;
      }
      // Disconnect if in error state
      await this.disconnect(config.id);
    }

    // Update state to connecting
    this.updateState(config.id, {
      config,
      status: "connecting",
    });

    try {
      console.log(`[GlobalMCP] Connecting to ${config.name} (${config.transport})`);
      
      const client = new Client({
        name: "mcp-client-app",
        version: "1.0.0",
      });

      let transport: TransportType;

      switch (config.transport) {
        case "stdio":
          if (!config.command) {
            throw new Error("Command is required for STDIO transport");
          }
          transport = new StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: config.env,
          });
          break;

        case "streamable-http":
          if (!config.url) {
            throw new Error("URL is required for Streamable HTTP transport");
          }
          transport = new StreamableHTTPClientTransport(new URL(config.url));
          break;

        case "sse":
          if (!config.url) {
            throw new Error("URL is required for SSE transport");
          }
          transport = new SSEClientTransport(new URL(config.url));
          break;

        default:
          throw new Error(`Unsupported transport type: ${config.transport}`);
      }

      await client.connect(transport);

      // Store client and transport globally
      this.globalState.clients.set(config.id, { client, transport, config });

      // Fetch capabilities
      const [tools, prompts, resources] = await Promise.all([
        this.fetchTools(client),
        this.fetchPrompts(client),
        this.fetchResources(client),
      ]);

      // Update state to connected
      const state: McpServerState = {
        config,
        status: "connected",
        tools,
        prompts,
        resources,
      };
      this.updateState(config.id, state);

      console.log(`[GlobalMCP] Connected to ${config.name} with ${tools.length} tools`);
      return state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[GlobalMCP] Failed to connect to ${config.name}:`, errorMessage);
      
      const state: McpServerState = {
        config,
        status: "error",
        error: errorMessage,
      };
      this.updateState(config.id, state);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const connected = this.globalState.clients.get(serverId);
    if (connected) {
      try {
        console.log(`[GlobalMCP] Disconnecting from ${connected.config.name}`);
        await connected.client.close();
      } catch (error) {
        console.error(`[GlobalMCP] Error closing client ${serverId}:`, error);
      }
      this.globalState.clients.delete(serverId);
    }

    const currentState = this.globalState.states.get(serverId);
    if (currentState) {
      this.updateState(serverId, {
        ...currentState,
        status: "disconnected",
        tools: undefined,
        prompts: undefined,
        resources: undefined,
      });
    }
  }

  /**
   * Get MCP client for a server
   */
  getClient(serverId: string): Client | undefined {
    return this.globalState.clients.get(serverId)?.client;
  }

  /**
   * Call a tool on a connected server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<ToolCallResponse> {
    const connected = this.globalState.clients.get(serverId);
    if (!connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await connected.client.callTool({
      name: toolName,
      arguments: args || {},
    });

    return {
      content: result.content as ToolCallResponse["content"],
      isError: result.isError as boolean | undefined,
    };
  }

  /**
   * Get a prompt from a connected server
   */
  async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<PromptGetResponse> {
    const connected = this.globalState.clients.get(serverId);
    if (!connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await connected.client.getPrompt({
      name: promptName,
      arguments: args,
    });

    return {
      description: result.description,
      messages: result.messages as PromptGetResponse["messages"],
    };
  }

  /**
   * Read a resource from a connected server
   */
  async readResource(serverId: string, uri: string): Promise<ResourceReadResponse> {
    const connected = this.globalState.clients.get(serverId);
    if (!connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await connected.client.readResource({ uri });

    return {
      contents: result.contents as ResourceReadResponse["contents"],
    };
  }

  /**
   * Get the state of a server
   */
  getState(serverId: string): McpServerState | undefined {
    return this.globalState.states.get(serverId);
  }

  /**
   * Get all server states
   */
  getAllStates(): McpServerState[] {
    return Array.from(this.globalState.states.values());
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverId: string): boolean {
    const connected = this.globalState.clients.get(serverId);
    return !!connected && this.globalState.states.get(serverId)?.status === "connected";
  }

  /**
   * Get connection status
   */
  getStatus(serverId: string): ConnectionStatus {
    return this.globalState.states.get(serverId)?.status || "disconnected";
  }

  /**
   * Get all connected client IDs
   */
  getConnectedIds(): string[] {
    return Array.from(this.globalState.clients.keys()).filter(id => 
      this.globalState.states.get(id)?.status === "connected"
    );
  }

  // Private methods

  private async fetchTools(client: Client): Promise<ToolInfo[]> {
    try {
      const result = await client.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    } catch {
      return [];
    }
  }

  private async fetchPrompts(client: Client): Promise<PromptInfo[]> {
    try {
      const result = await client.listPrompts();
      return result.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required,
        })),
      }));
    } catch {
      return [];
    }
  }

  private async fetchResources(client: Client): Promise<ResourceInfo[]> {
    try {
      const result = await client.listResources();
      return result.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    } catch {
      return [];
    }
  }

  private updateState(serverId: string, state: McpServerState): void {
    this.globalState.states.set(serverId, state);
  }
}

// Export singleton instance getter
let managerInstance: GlobalMcpClientManager | null = null;

export function getGlobalMcpClientManager(): GlobalMcpClientManager {
  if (!managerInstance) {
    managerInstance = new GlobalMcpClientManager();
  }
  return managerInstance;
}

