"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import type {
  McpServerConfig,
  McpServerState,
  ConnectionStatus,
  ToolCallResponse,
  PromptGetResponse,
  ResourceReadResponse,
  ApiResponse,
} from "@/lib/mcp/types";

const STORAGE_KEY = "mcp_servers";
const CONNECTED_KEY = "mcp_connected_servers";

interface McpContextValue {
  // Server configs (stored in localStorage)
  servers: McpServerConfig[];
  addServer: (config: McpServerConfig) => void;
  updateServer: (config: McpServerConfig) => void;
  removeServer: (serverId: string) => void;

  // Connection states (from API)
  serverStates: Map<string, McpServerState>;
  getServerState: (serverId: string) => McpServerState | undefined;
  getConnectionStatus: (serverId: string) => ConnectionStatus;

  // Actions
  connect: (serverId: string) => Promise<void>;
  disconnect: (serverId: string) => Promise<void>;
  refreshStatus: () => Promise<void>;

  // Tool/Prompt/Resource operations
  callTool: (
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ) => Promise<ToolCallResponse>;
  getPrompt: (
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ) => Promise<PromptGetResponse>;
  readResource: (serverId: string, uri: string) => Promise<ResourceReadResponse>;

  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => void;

  // Loading state
  isLoading: boolean;
}

const McpContext = createContext<McpContextValue | undefined>(undefined);

export function McpProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [serverStates, setServerStates] = useState<Map<string, McpServerState>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const autoReconnectAttempted = useRef(false);

  // Load servers from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setServers(parsed);
      } catch (e) {
        console.error("Failed to parse saved MCP servers:", e);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save servers to localStorage when changed
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
    }
  }, [servers, isHydrated]);

  // Auto-reconnect to previously connected servers
  useEffect(() => {
    if (!isHydrated || servers.length === 0 || autoReconnectAttempted.current) {
      return;
    }

    const connectedIds: string[] = JSON.parse(
      localStorage.getItem(CONNECTED_KEY) || "[]"
    );

    if (connectedIds.length === 0) {
      return;
    }

    autoReconnectAttempted.current = true;

    const reconnect = async () => {
      for (const serverId of connectedIds) {
        const serverExists = servers.find((s) => s.id === serverId);
        if (serverExists) {
          try {
            console.log(`Auto-reconnecting to MCP server: ${serverExists.name}`);
            const config = serverExists;

            // Set connecting state
            setServerStates((prev) => {
              const newMap = new Map(prev);
              newMap.set(serverId, {
                config,
                status: "connecting",
              });
              return newMap;
            });

            const response = await fetch("/api/mcp/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config),
            });

            const result: ApiResponse<McpServerState> = await response.json();

            if (result.success && result.data) {
              setServerStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(serverId, result.data!);
                return newMap;
              });
              console.log(`Auto-reconnected to MCP server: ${serverExists.name}`);
            } else {
              throw new Error(result.error || "Connection failed");
            }
          } catch (e) {
            console.error(`Auto-reconnect failed for ${serverId}:`, e);
            // Remove from connected list if reconnection fails
            const currentConnected = JSON.parse(
              localStorage.getItem(CONNECTED_KEY) || "[]"
            );
            localStorage.setItem(
              CONNECTED_KEY,
              JSON.stringify(currentConnected.filter((id: string) => id !== serverId))
            );
          }
        }
      }
    };

    reconnect();
  }, [isHydrated, servers]);

  // Add a new server
  const addServer = useCallback((config: McpServerConfig) => {
    setServers((prev) => [...prev, config]);
  }, []);

  // Update an existing server
  const updateServer = useCallback((config: McpServerConfig) => {
    setServers((prev) =>
      prev.map((s) => (s.id === config.id ? config : s))
    );
  }, []);

  // Remove a server
  const removeServer = useCallback((serverId: string) => {
    setServers((prev) => prev.filter((s) => s.id !== serverId));
    setServerStates((prev) => {
      const newMap = new Map(prev);
      newMap.delete(serverId);
      return newMap;
    });
    // Remove from connected list
    const connected = JSON.parse(localStorage.getItem(CONNECTED_KEY) || "[]");
    localStorage.setItem(
      CONNECTED_KEY,
      JSON.stringify(connected.filter((id: string) => id !== serverId))
    );
  }, []);

  // Get server state
  const getServerState = useCallback(
    (serverId: string) => serverStates.get(serverId),
    [serverStates]
  );

  // Get connection status
  const getConnectionStatus = useCallback(
    (serverId: string): ConnectionStatus => {
      return serverStates.get(serverId)?.status || "disconnected";
    },
    [serverStates]
  );

  // Connect to a server
  const connect = useCallback(
    async (serverId: string) => {
      const config = servers.find((s) => s.id === serverId);
      if (!config) {
        throw new Error("Server not found");
      }

      // Set connecting state
      setServerStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(serverId, {
          config,
          status: "connecting",
        });
        return newMap;
      });

      try {
        const response = await fetch("/api/mcp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        const result: ApiResponse<McpServerState> = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Connection failed");
        }

        setServerStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(serverId, result.data!);
          return newMap;
        });

        // Save connected server to localStorage
        const connected = JSON.parse(localStorage.getItem(CONNECTED_KEY) || "[]");
        if (!connected.includes(serverId)) {
          localStorage.setItem(CONNECTED_KEY, JSON.stringify([...connected, serverId]));
        }
      } catch (error) {
        setServerStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(serverId, {
            config,
            status: "error",
            error: error instanceof Error ? error.message : "Connection failed",
          });
          return newMap;
        });
        throw error;
      }
    },
    [servers]
  );

  // Disconnect from a server
  const disconnect = useCallback(async (serverId: string) => {
    try {
      await fetch("/api/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });

      setServerStates((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(serverId);
        if (current) {
          newMap.set(serverId, {
            ...current,
            status: "disconnected",
            tools: undefined,
            prompts: undefined,
            resources: undefined,
          });
        }
        return newMap;
      });

      // Remove from localStorage
      const connected = JSON.parse(localStorage.getItem(CONNECTED_KEY) || "[]");
      localStorage.setItem(
        CONNECTED_KEY,
        JSON.stringify(connected.filter((id: string) => id !== serverId))
      );
    } catch (error) {
      console.error("Disconnect error:", error);
      throw error;
    }
  }, []);

  // Refresh status from API
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/mcp/status");
      const result: ApiResponse<McpServerState[]> = await response.json();

      if (result.success && result.data) {
        setServerStates((prev) => {
          const newMap = new Map(prev);
          result.data!.forEach((state) => {
            newMap.set(state.config.id, state);
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Call a tool
  const callTool = useCallback(
    async (
      serverId: string,
      toolName: string,
      args?: Record<string, unknown>
    ): Promise<ToolCallResponse> => {
      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, toolName, arguments: args }),
      });

      const result: ApiResponse<ToolCallResponse> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Tool call failed");
      }

      return result.data!;
    },
    []
  );

  // Get a prompt
  const getPrompt = useCallback(
    async (
      serverId: string,
      promptName: string,
      args?: Record<string, string>
    ): Promise<PromptGetResponse> => {
      const response = await fetch("/api/mcp/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, promptName, arguments: args }),
      });

      const result: ApiResponse<PromptGetResponse> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Get prompt failed");
      }

      return result.data!;
    },
    []
  );

  // Read a resource
  const readResource = useCallback(
    async (serverId: string, uri: string): Promise<ResourceReadResponse> => {
      const response = await fetch("/api/mcp/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, uri }),
      });

      const result: ApiResponse<ResourceReadResponse> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Read resource failed");
      }

      return result.data!;
    },
    []
  );

  // Export config
  const exportConfig = useCallback(() => {
    return JSON.stringify(servers, null, 2);
  }, [servers]);

  // Import config
  const importConfig = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid config format");
      }
      setServers(parsed);
    } catch (error) {
      throw new Error("Failed to parse config");
    }
  }, []);

  const value: McpContextValue = {
    servers,
    addServer,
    updateServer,
    removeServer,
    serverStates,
    getServerState,
    getConnectionStatus,
    connect,
    disconnect,
    refreshStatus,
    callTool,
    getPrompt,
    readResource,
    exportConfig,
    importConfig,
    isLoading,
  };

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}

export function useMcp() {
  const context = useContext(McpContext);
  if (!context) {
    throw new Error("useMcp must be used within McpProvider");
  }
  return context;
}

