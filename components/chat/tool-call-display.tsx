"use client";

import { Wrench, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 my-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Wrench className="w-4 h-4" />
        <span>도구 호출 ({toolCalls.length})</span>
      </div>
      
      <div className="space-y-2">
        {toolCalls.map((tool, index) => {
          const isExpanded = expandedTools.has(index);
          const isCompleted = !!tool.result;

          return (
            <div
              key={index}
              className="border dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden"
            >
              {/* Tool Header */}
              <button
                onClick={() => toggleExpand(index)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  <div className="text-left">
                    <span className="font-mono text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {tool.name}
                    </span>
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {isCompleted ? "완료" : "실행 중..."}
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t dark:border-zinc-700 px-4 py-3 space-y-3">
                  {/* Arguments */}
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      인자 (Arguments)
                    </div>
                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 rounded p-2 overflow-x-auto">
                      <code className="text-zinc-700 dark:text-zinc-300">
                        {JSON.stringify(tool.args, null, 2)}
                      </code>
                    </pre>
                  </div>

                  {/* Result */}
                  {tool.result && (
                    <div>
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        결과 (Result)
                      </div>
                      <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 rounded p-2 overflow-x-auto max-h-48">
                        <code className="text-zinc-700 dark:text-zinc-300">
                          {tool.result}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

