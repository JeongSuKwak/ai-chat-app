"use client";

import { useState } from "react";
import { FileText, Eye, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";
import type { ResourceInfo, ResourceReadResponse } from "@/lib/mcp/types";

interface ResourcesPanelProps {
  serverId: string;
  resources: ResourceInfo[];
}

export function ResourcesPanel({ serverId, resources }: ResourcesPanelProps) {
  const { readResource } = useMcp();
  const [expandedResource, setExpandedResource] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResourceReadResponse | { error: string }>>({});

  const handleReadResource = async (uri: string) => {
    setLoading(uri);
    try {
      const result = await readResource(serverId, uri);
      setResults((prev) => ({ ...prev, [uri]: result }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [uri]: { error: error instanceof Error ? error.message : "Failed to read resource" },
      }));
    } finally {
      setLoading(null);
    }
  };

  if (resources.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>사용 가능한 Resource가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {resources.map((resource) => {
        const isExpanded = expandedResource === resource.uri;
        const result = results[resource.uri];
        const isLoading = loading === resource.uri;

        return (
          <div
            key={resource.uri}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
          >
            {/* Resource Header */}
            <button
              onClick={() => setExpandedResource(isExpanded ? null : resource.uri)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="font-medium">{resource.name}</span>
                {resource.mimeType && (
                  <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">
                    {resource.mimeType}
                  </span>
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
                {/* URI */}
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    URI
                  </label>
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded block overflow-x-auto">
                    {resource.uri}
                  </code>
                </div>

                {/* Description */}
                {resource.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {resource.description}
                  </p>
                )}

                {/* Read Button */}
                <button
                  onClick={() => handleReadResource(resource.uri)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  읽기
                </button>

                {/* Result */}
                {result && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      내용
                    </label>
                    {"error" in result ? (
                      <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {result.error}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {result.contents.map((content, idx) => (
                          <div key={idx} className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
                            {content.mimeType && (
                              <span className="text-xs text-gray-500 block mb-1">
                                {content.mimeType}
                              </span>
                            )}
                            {content.text ? (
                              <pre className="text-xs whitespace-pre-wrap overflow-x-auto max-h-64">
                                {content.text}
                              </pre>
                            ) : content.blob ? (
                              <p className="text-xs text-gray-500">
                                Binary data ({content.blob.length} bytes)
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">Empty content</p>
                            )}
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

