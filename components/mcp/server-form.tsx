"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { McpServerConfig, TransportType } from "@/lib/mcp/types";

interface ServerFormProps {
  onSubmit: (config: McpServerConfig) => void;
  onCancel: () => void;
  initialData?: McpServerConfig;
}

export function ServerForm({ onSubmit, onCancel, initialData }: ServerFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [transport, setTransport] = useState<TransportType>(
    initialData?.transport || "stdio"
  );
  const [command, setCommand] = useState(initialData?.command || "");
  const [args, setArgs] = useState<string[]>(initialData?.args || []);
  const [url, setUrl] = useState(initialData?.url || "");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>(
    initialData?.env
      ? Object.entries(initialData.env).map(([key, value]) => ({ key, value }))
      : []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: McpServerConfig = {
      id: initialData?.id || crypto.randomUUID(),
      name,
      transport,
    };

    if (transport === "stdio") {
      config.command = command;
      config.args = args.filter((a) => a.trim());
      if (envPairs.length > 0) {
        config.env = envPairs.reduce(
          (acc, { key, value }) => {
            if (key.trim()) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>
        );
      }
    } else {
      config.url = url;
    }

    onSubmit(config);
  };

  const addArg = () => setArgs([...args, ""]);
  const removeArg = (index: number) => setArgs(args.filter((_, i) => i !== index));
  const updateArg = (index: number, value: string) => {
    const newArgs = [...args];
    newArgs[index] = value;
    setArgs(newArgs);
  };

  const addEnvPair = () => setEnvPairs([...envPairs, { key: "", value: "" }]);
  const removeEnvPair = (index: number) =>
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  const updateEnvPair = (index: number, field: "key" | "value", value: string) => {
    const newPairs = [...envPairs];
    newPairs[index][field] = value;
    setEnvPairs(newPairs);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">서버 이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My MCP Server"
          className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Transport Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Transport 유형</label>
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as TransportType)}
          className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="stdio">STDIO</option>
          <option value="streamable-http">Streamable HTTP</option>
          <option value="sse">SSE (Server-Sent Events)</option>
        </select>
      </div>

      {/* STDIO Options */}
      {transport === "stdio" && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">명령어</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              required
              placeholder="npx, node, python..."
              className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">인자 (Arguments)</label>
            <div className="space-y-2">
              {args.map((arg, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={arg}
                    onChange={(e) => updateArg(index, e.target.value)}
                    placeholder={`인자 ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeArg(index)}
                    className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addArg}
                className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
              >
                <Plus className="w-4 h-4" /> 인자 추가
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">환경변수</label>
            <div className="space-y-2">
              {envPairs.map((pair, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => updateEnvPair(index, "key", e.target.value)}
                    placeholder="KEY"
                    className="w-1/3 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                  />
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => updateEnvPair(index, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvPair(index)}
                    className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addEnvPair}
                className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
              >
                <Plus className="w-4 h-4" /> 환경변수 추가
              </button>
            </div>
          </div>
        </>
      )}

      {/* HTTP/SSE Options */}
      {(transport === "streamable-http" || transport === "sse") && (
        <div>
          <label className="block text-sm font-medium mb-1">서버 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="http://localhost:3000/mcp"
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {initialData ? "수정" : "추가"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  );
}

