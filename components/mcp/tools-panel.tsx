"use client";

import { useState } from "react";
import { Wrench, Play, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";
import type { ToolInfo, ToolCallResponse } from "@/lib/mcp/types";

interface ToolsPanelProps {
  serverId: string;
  tools: ToolInfo[];
}

export function ToolsPanel({ serverId, tools }: ToolsPanelProps) {
  const { callTool } = useMcp();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ToolCallResponse | { error: string }>>({});

  const handleExecute = async (toolName: string) => {
    setExecuting(toolName);
    try {
      // Parse args from JSON string
      let parsedArgs: Record<string, unknown> = {};
      const argsString = toolArgs[toolName];
      if (argsString?.trim()) {
        try {
          parsedArgs = JSON.parse(argsString);
        } catch {
          setResults((prev) => ({
            ...prev,
            [toolName]: { error: "Invalid JSON arguments" },
          }));
          return;
        }
      }

      const result = await callTool(serverId, toolName, parsedArgs);
      setResults((prev) => ({ ...prev, [toolName]: result }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [toolName]: { error: error instanceof Error ? error.message : "Execution failed" },
      }));
    } finally {
      setExecuting(null);
    }
  };

  if (tools.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>사용 가능한 Tool이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const isExpanded = expandedTool === tool.name;
        const result = results[tool.name];
        const isExecuting = executing === tool.name;

        return (
          <div
            key={tool.name}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
          >
            {/* Tool Header */}
            <button
              onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <Wrench className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{tool.name}</span>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
                {/* Description */}
                {tool.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {tool.description}
                  </p>
                )}

                {/* Input Schema */}
                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Input Schema
                    </label>
                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Arguments Input */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Arguments (JSON)
                  </label>
                  <textarea
                    value={toolArgs[tool.name] || ""}
                    onChange={(e) =>
                      setToolArgs((prev) => ({ ...prev, [tool.name]: e.target.value }))
                    }
                    placeholder='{"param": "value"}'
                    className="w-full px-3 py-2 text-sm font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    rows={3}
                  />
                </div>

                {/* Execute Button */}
                <button
                  onClick={() => handleExecute(tool.name)}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isExecuting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  실행
                </button>

                {/* Result */}
                {result && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      결과
                    </label>
                    {"error" in result ? (
                      <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {result.error}
                      </div>
                    ) : (
                      <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded overflow-x-auto max-h-64">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

