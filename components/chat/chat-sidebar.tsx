"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useChat } from "@/contexts/chat-context";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return "오늘";
  } else if (diffDays === 1) {
    return "어제";
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  }
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ isOpen, onToggle }: ChatSidebarProps) {
  const { sessions, currentSessionId, createSession, deleteSession, selectSession } =
    useChat();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleNewChat = () => {
    createSession();
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm("이 채팅을 삭제하시겠습니까?")) {
      deleteSession(sessionId);
    }
  };

  return (
    <>
      {/* Toggle Button (when sidebar is closed) - Desktop only */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden md:flex fixed top-4 left-4 z-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          title="사이드바 열기"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 z-30 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "280px" }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold">채팅 기록</h2>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="사이드바 닫기"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 채팅
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">채팅 기록이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => {
                  const isSelected = session.id === currentSessionId;
                  const isHovered = session.id === hoveredId;

                  return (
                    <div
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      onMouseEnter={() => setHoveredId(session.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {formatDate(session.updatedAt)} · {session.messages.length}개 메시지
                        </p>
                      </div>
                      {(isHovered || isSelected) && (
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}

