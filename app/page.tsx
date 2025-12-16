"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send, Bot, User, Loader2, Trash2, Server, Wrench, X, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ToolCallDisplay } from "@/components/chat/tool-call-display";
import { useMcp } from "@/contexts/mcp-context";
import { useChat } from "@/contexts/chat-context";

// Model types
type ModelProvider = "gemini" | "claude";

interface ModelOption {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "빠르고 효율적인 Google AI 모델",
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "claude",
    description: "균형 잡힌 Anthropic AI 모델",
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "claude",
    description: "가장 강력한 Anthropic AI 모델",
  },
];

const MODEL_STORAGE_KEY = "selected_model";

// SSE Event types
interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
  serverId: string;
}

interface ToolResultEvent {
  type: "tool_result";
  toolName: string;
  result: string;
  serverId: string;
}

interface TextEvent {
  type: "text";
  content: string;
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type StreamEvent = ToolCallEvent | ToolResultEvent | TextEvent | ErrorEvent;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AVAILABLE_MODELS[0]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [toolCalls, setToolCalls] = useState<Array<{ name: string; args: Record<string, unknown>; result?: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { servers, serverStates } = useMcp();
  const {
    currentSession,
    currentSessionId,
    createSession,
    addMessage,
    updateLastMessage,
    clearCurrentSession,
  } = useChat();

  // Load saved model preference
  useEffect(() => {
    const savedModelId = localStorage.getItem(MODEL_STORAGE_KEY);
    if (savedModelId) {
      const savedModel = AVAILABLE_MODELS.find(m => m.id === savedModelId);
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Count connected servers
  const connectedCount = Array.from(serverStates.values()).filter(
    (s) => s.status === "connected"
  ).length;

  const messages = currentSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolCalls]);

  const parseSSEEvent = (data: string): StreamEvent | null => {
    try {
      return JSON.parse(data) as StreamEvent;
    } catch {
      return null;
    }
  };

  const handleSelectModel = (model: ModelOption) => {
    setSelectedModel(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model.id);
    setModelDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputValue = inputRef.current?.value.trim() || "";
    if (!inputValue || isLoading) return;

    // Create session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    const userMessage = { role: "user" as const, content: inputValue };
    addMessage(userMessage, sessionId);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setIsLoading(true);
    setToolCalls([]);

    try {
      // Send all messages including the new one
      const allMessages = [...messages, userMessage];

      // Get connected MCP server configs
      const connectedServerConfigs = servers.filter(
        (server) => serverStates.get(server.id)?.status === "connected"
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: allMessages,
          mcpServers: connectedServerConfigs,
          mcpEnabled: mcpEnabled && connectedServerConfigs.length > 0,
          model: selectedModel.id,
          provider: selectedModel.provider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText);
      }
      if (!response.body) throw new Error("No response body");

      // Initialize empty assistant message
      addMessage({ role: "assistant", content: "" }, sessionId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const eventData = line.slice(6);
            const event = parseSSEEvent(eventData);
            
            if (event) {
              switch (event.type) {
                case "text":
                  accumulatedContent += event.content;
                  updateLastMessage(accumulatedContent, sessionId);
                  break;
                case "tool_call":
                  setToolCalls(prev => [...prev, { 
                    name: event.toolName, 
                    args: event.args 
                  }]);
                  break;
                case "tool_result":
                  setToolCalls(prev => prev.map(tc => 
                    tc.name === event.toolName && !tc.result 
                      ? { ...tc, result: event.result }
                      : tc
                  ));
                  break;
                case "error":
                  accumulatedContent += `\n\n⚠️ **오류**: ${event.message}`;
                  updateLastMessage(accumulatedContent, sessionId);
                  break;
              }
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error("Chat error:", error);
      let errorMessage = error instanceof Error ? error.message : "Failed to get response.";
      
      // Handle common errors with user-friendly messages
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        errorMessage = "API 할당량을 초과했습니다. 잠시 후 다시 시도해 주세요.";
      } else if (errorMessage.includes("Failed to fetch")) {
        errorMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요.";
      }
      
      addMessage({
        role: "assistant",
        content: `⚠️ **오류 발생**\n\n${errorMessage}`,
      }, sessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("현재 채팅의 모든 내용을 삭제하시겠습니까?")) {
      clearCurrentSession();
      setToolCalls([]);
    }
  };

  const toggleMcp = () => {
    setMcpEnabled(!mcpEnabled);
  };

  const getModelIcon = (provider: ModelProvider) => {
    if (provider === "gemini") {
      return (
        <span className="text-blue-500 font-bold text-xs">G</span>
      );
    }
    return (
      <span className="text-orange-500 font-bold text-xs">C</span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar */}
      <ChatSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "lg:ml-[280px]" : ""
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-950 border-b dark:border-zinc-800 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-blue-500" />
            
            {/* Model Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium"
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center ${
                  selectedModel.provider === "gemini" 
                    ? "bg-blue-100 dark:bg-blue-900/50" 
                    : "bg-orange-100 dark:bg-orange-900/50"
                }`}>
                  {getModelIcon(selectedModel.provider)}
                </span>
                <span>{selectedModel.name}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {modelDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border dark:border-zinc-700 overflow-hidden z-50">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left ${
                        selectedModel.id === model.id ? "bg-zinc-50 dark:bg-zinc-700/50" : ""
                      }`}
                    >
                      <span className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        model.provider === "gemini" 
                          ? "bg-blue-100 dark:bg-blue-900/50" 
                          : "bg-orange-100 dark:bg-orange-900/50"
                      }`}>
                        {getModelIcon(model.provider)}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{model.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{model.description}</div>
                      </div>
                      {selectedModel.id === model.id && (
                        <span className="ml-auto text-green-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentSession && (
              <span className="text-sm text-gray-400 max-w-[150px] truncate">
                {currentSession.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* MCP Tools Toggle */}
            <button
              onClick={toggleMcp}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                mcpEnabled && connectedCount > 0
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title={mcpEnabled ? "MCP 도구 비활성화" : "MCP 도구 활성화"}
            >
              {mcpEnabled ? (
                <Wrench className="w-4 h-4" />
              ) : (
                <span className="relative">
                  <Wrench className="w-4 h-4" />
                  <X className="w-3 h-3 absolute -top-1 -right-1 text-red-500" />
                </span>
              )}
              <span className="hidden sm:inline">
                {mcpEnabled ? "도구 ON" : "도구 OFF"}
              </span>
            </button>

            <Link
              href="/mcp"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Server className="w-4 h-4" />
              <span>MCP</span>
              {servers.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full ${
                    connectedCount > 0
                      ? "bg-green-500 text-white"
                      : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  {connectedCount}/{servers.length}
                </span>
              )}
            </Link>
            {currentSession && messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                title="현재 채팅 내용 삭제"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Chat List */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!currentSession || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bot className="w-12 h-12 mb-4 opacity-20" />
              <p>Start a conversation with {selectedModel.name}</p>
              {!currentSession && (
                <p className="text-sm mt-2">사이드바에서 새 채팅을 시작하세요</p>
              )}
              {connectedCount > 0 && mcpEnabled && (
                <p className="text-sm mt-2 text-green-500">
                  🔧 {connectedCount}개의 MCP 도구가 활성화되어 있습니다
                </p>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white"
                        : selectedModel.provider === "gemini"
                          ? "bg-blue-500 text-white"
                          : "bg-orange-500 text-white"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-none whitespace-pre-wrap leading-relaxed"
                        : "bg-white dark:bg-zinc-800 border dark:border-zinc-700 shadow-sm rounded-bl-none"
                    }`}
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <MarkdownRenderer
                        content={msg.content}
                        isStreaming={isLoading && index === messages.length - 1}
                      />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Tool Calls Display */}
              {toolCalls.length > 0 && (
                <ToolCallDisplay toolCalls={toolCalls} />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-zinc-950 border-t dark:border-zinc-800">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto flex items-center gap-2 relative"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Message ${selectedModel.name}...`}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-900 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <p className="text-xs text-center text-gray-400 mt-2">
            {selectedModel.name} can make mistakes. Consider checking important information.
            {mcpEnabled && connectedCount > 0 && (
              <span className="ml-2 text-green-500">• MCP 도구 활성화됨</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
