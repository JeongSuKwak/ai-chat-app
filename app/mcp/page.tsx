"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wrench, MessageSquare, FileText, Settings } from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";
import { ServerList } from "@/components/mcp/server-list";
import { ToolsPanel } from "@/components/mcp/tools-panel";
import { PromptsPanel } from "@/components/mcp/prompts-panel";
import { ResourcesPanel } from "@/components/mcp/resources-panel";
import { ConfigExportImport } from "@/components/mcp/config-export-import";

type TabType = "tools" | "prompts" | "resources";

export default function McpPage() {
  const { getServerState, getConnectionStatus } = useMcp();
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TabType>("tools");
  const [showSettings, setShowSettings] = useState(false);

  const selectedServer = selectedServerId ? getServerState(selectedServerId) : undefined;
  const isConnected = selectedServerId
    ? getConnectionStatus(selectedServerId) === "connected"
    : false;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "tools",
      label: "Tools",
      icon: <Wrench className="w-4 h-4" />,
      count: selectedServer?.tools?.length,
    },
    {
      id: "prompts",
      label: "Prompts",
      icon: <MessageSquare className="w-4 h-4" />,
      count: selectedServer?.prompts?.length,
    },
    {
      id: "resources",
      label: "Resources",
      icon: <FileText className="w-4 h-4" />,
      count: selectedServer?.resources?.length,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold">MCP Server 관리</h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-500"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold mb-4">설정</h2>
            <ConfigExportImport />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
              <ServerList
                onSelectServer={setSelectedServerId}
                selectedServerId={selectedServerId}
              />
            </div>
          </div>

          {/* Server Details */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              {!selectedServerId ? (
                <div className="p-8 text-center text-gray-400">
                  <Settings className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>서버를 선택하세요</p>
                </div>
              ) : !isConnected ? (
                <div className="p-8 text-center text-gray-400">
                  <Settings className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>서버가 연결되어 있지 않습니다</p>
                  <p className="text-sm mt-1">연결 버튼을 클릭하세요</p>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? "border-blue-500 text-blue-500"
                            : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.count !== undefined && (
                          <span className="px-1.5 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 rounded-full">
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="p-4">
                    {activeTab === "tools" && selectedServer?.tools && (
                      <ToolsPanel
                        serverId={selectedServerId}
                        tools={selectedServer.tools}
                      />
                    )}
                    {activeTab === "prompts" && selectedServer?.prompts && (
                      <PromptsPanel
                        serverId={selectedServerId}
                        prompts={selectedServer.prompts}
                      />
                    )}
                    {activeTab === "resources" && selectedServer?.resources && (
                      <ResourcesPanel
                        serverId={selectedServerId}
                        resources={selectedServer.resources}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

