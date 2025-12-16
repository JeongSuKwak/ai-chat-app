"use client";

import { useState } from "react";
import {
  Server,
  Plug,
  PlugZap,
  Trash2,
  Edit,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";
import { ServerForm } from "./server-form";
import type { McpServerConfig, ConnectionStatus } from "@/lib/mcp/types";

const statusConfig: Record<
  ConnectionStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  disconnected: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-gray-400",
    label: "연결 안됨",
  },
  connecting: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: "text-yellow-500",
    label: "연결 중...",
  },
  connected: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: "text-green-500",
    label: "연결됨",
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: "text-red-500",
    label: "오류",
  },
};

interface ServerListProps {
  onSelectServer: (serverId: string) => void;
  selectedServerId?: string;
}

export function ServerList({ onSelectServer, selectedServerId }: ServerListProps) {
  const { servers, addServer, updateServer, removeServer, connect, disconnect, getConnectionStatus, getServerState } =
    useMcp();
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleConnect = async (serverId: string) => {
    setLoadingId(serverId);
    try {
      await connect(serverId);
    } catch (error) {
      console.error("Connect error:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    setLoadingId(serverId);
    try {
      await disconnect(serverId);
    } catch (error) {
      console.error("Disconnect error:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleAddServer = (config: McpServerConfig) => {
    if (editingServer) {
      updateServer(config);
    } else {
      addServer(config);
    }
    setShowForm(false);
    setEditingServer(null);
  };

  const handleEdit = (server: McpServerConfig) => {
    setEditingServer(server);
    setShowForm(true);
  };

  const handleDelete = (serverId: string) => {
    if (confirm("이 서버를 삭제하시겠습니까?")) {
      removeServer(serverId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5" />
          MCP 서버
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            서버 추가
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium mb-3">
            {editingServer ? "서버 수정" : "새 서버 추가"}
          </h3>
          <ServerForm
            onSubmit={handleAddServer}
            onCancel={() => {
              setShowForm(false);
              setEditingServer(null);
            }}
            initialData={editingServer || undefined}
          />
        </div>
      )}

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Server className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>등록된 MCP 서버가 없습니다</p>
          <p className="text-sm">새 서버를 추가하세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => {
            const status = getConnectionStatus(server.id);
            const state = getServerState(server.id);
            const statusInfo = statusConfig[status];
            const isSelected = selectedServerId === server.id;
            const isLoading = loadingId === server.id;

            return (
              <div
                key={server.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
                onClick={() => onSelectServer(server.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={statusInfo.color}>{statusInfo.icon}</span>
                    <span className="font-medium">{server.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                      {server.transport}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {status === "connected" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnect(server.id);
                        }}
                        disabled={isLoading}
                        className="p-1.5 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-colors"
                        title="연결 해제"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlugZap className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnect(server.id);
                        }}
                        disabled={isLoading || status === "connecting"}
                        className="p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                        title="연결"
                      >
                        {isLoading || status === "connecting" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plug className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(server);
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
                      title="수정"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(server.id);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {status === "error" && state?.error && (
                  <p className="mt-2 text-xs text-red-500">{state.error}</p>
                )}

                {/* Connected info */}
                {status === "connected" && state && (
                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>Tools: {state.tools?.length || 0}</span>
                    <span>Prompts: {state.prompts?.length || 0}</span>
                    <span>Resources: {state.resources?.length || 0}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

