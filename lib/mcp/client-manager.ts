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

interface ConnectedClient {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;
}

/**
 * MCP Client Manager - Singleton Pattern
 * Manages multiple MCP server connections
 */
class McpClientManager {
  private static instance: McpClientManager;
  private clients: Map<string, ConnectedClient> = new Map();
  private states: Map<string, McpServerState> = new Map();

  private constructor() {}

  static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: McpServerConfig): Promise<McpServerState> {
    // If already connected, disconnect first
    if (this.clients.has(config.id)) {
      await this.disconnect(config.id);
    }

    // Update state to connecting
    this.updateState(config.id, {
      config,
      status: "connecting",
    });

    try {
      const client = new Client({
        name: "mcp-client-app",
        version: "1.0.0",
      });

      let transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;

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

      // Store client and transport
      this.clients.set(config.id, { client, transport });

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

      return state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    const connected = this.clients.get(serverId);
    if (connected) {
      try {
        await connected.client.close();
      } catch (error) {
        console.error(`Error closing client ${serverId}:`, error);
      }
      this.clients.delete(serverId);
    }

    const currentState = this.states.get(serverId);
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
   * Call a tool on a connected server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<ToolCallResponse> {
    const connected = this.clients.get(serverId);
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
    const connected = this.clients.get(serverId);
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
    const connected = this.clients.get(serverId);
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
    return this.states.get(serverId);
  }

  /**
   * Get all server states
   */
  getAllStates(): McpServerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  /**
   * Get connection status
   */
  getStatus(serverId: string): ConnectionStatus {
    return this.states.get(serverId)?.status || "disconnected";
  }

  /**
   * Refresh capabilities for a connected server
   */
  async refreshCapabilities(serverId: string): Promise<McpServerState> {
    const connected = this.clients.get(serverId);
    const state = this.states.get(serverId);

    if (!connected || !state) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const [tools, prompts, resources] = await Promise.all([
      this.fetchTools(connected.client),
      this.fetchPrompts(connected.client),
      this.fetchResources(connected.client),
    ]);

    const newState: McpServerState = {
      ...state,
      tools,
      prompts,
      resources,
    };
    this.updateState(serverId, newState);

    return newState;
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
    this.states.set(serverId, state);
  }
}

// Export singleton instance getter
export const getMcpClientManager = () => McpClientManager.getInstance();

