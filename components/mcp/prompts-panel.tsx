"use client";

import { useState } from "react";
import { MessageSquare, Play, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";
import type { PromptInfo, PromptGetResponse } from "@/lib/mcp/types";

interface PromptsPanelProps {
  serverId: string;
  prompts: PromptInfo[];
}

export function PromptsPanel({ serverId, prompts }: PromptsPanelProps) {
  const { getPrompt } = useMcp();
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [promptArgs, setPromptArgs] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, PromptGetResponse | { error: string }>>({});

  const handleGetPrompt = async (promptName: string, args?: PromptInfo["arguments"]) => {
    setLoading(promptName);
    try {
      const promptArgValues = promptArgs[promptName] || {};
      const result = await getPrompt(serverId, promptName, promptArgValues);
      setResults((prev) => ({ ...prev, [promptName]: result }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [promptName]: { error: error instanceof Error ? error.message : "Failed to get prompt" },
      }));
    } finally {
      setLoading(null);
    }
  };

  const updatePromptArg = (promptName: string, argName: string, value: string) => {
    setPromptArgs((prev) => ({
      ...prev,
      [promptName]: {
        ...prev[promptName],
        [argName]: value,
      },
    }));
  };

  if (prompts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>사용 가능한 Prompt가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {prompts.map((prompt) => {
        const isExpanded = expandedPrompt === prompt.name;
        const result = results[prompt.name];
        const isLoading = loading === prompt.name;
        const currentArgs = promptArgs[prompt.name] || {};

        return (
          <div
            key={prompt.name}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
          >
            {/* Prompt Header */}
            <button
              onClick={() => setExpandedPrompt(isExpanded ? null : prompt.name)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <span className="font-medium">{prompt.name}</span>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
                {/* Description */}
                {prompt.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {prompt.description}
                  </p>
                )}

                {/* Arguments Input */}
                {prompt.arguments && prompt.arguments.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <label className="block text-xs font-medium text-gray-500">
                      Arguments
                    </label>
                    {prompt.arguments.map((arg) => (
                      <div key={arg.name}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {arg.name}
                          {arg.required && <span className="text-red-500">*</span>}
                          {arg.description && (
                            <span className="ml-1 text-gray-400">- {arg.description}</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={currentArgs[arg.name] || ""}
                          onChange={(e) =>
                            updatePromptArg(prompt.name, arg.name, e.target.value)
                          }
                          placeholder={arg.name}
                          className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Get Button */}
                <button
                  onClick={() => handleGetPrompt(prompt.name, prompt.arguments)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  가져오기
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
                      <div className="space-y-2">
                        {result.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {result.description}
                          </p>
                        )}
                        {result.messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-sm ${
                              msg.role === "user"
                                ? "bg-blue-100 dark:bg-blue-900/30"
                                : "bg-zinc-100 dark:bg-zinc-900"
                            }`}
                          >
                            <span className="font-medium capitalize">{msg.role}:</span>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {msg.content.text || JSON.stringify(msg.content)}
                            </pre>
                          </div>
                        ))}
                      </div>
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

