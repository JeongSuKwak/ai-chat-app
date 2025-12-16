"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import type { ChatSession, Message } from "@/lib/chat/types";

const STORAGE_KEY = "chat_sessions";
const CURRENT_SESSION_KEY = "current_session_id";

interface ChatContextValue {
  // Sessions
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;

  // Actions
  createSession: () => string;
  deleteSession: (sessionId: string) => void;
  selectSession: (sessionId: string) => void;
  
  // Message operations
  addMessage: (message: Message, sessionId?: string) => void;
  updateLastMessage: (content: string, sessionId?: string) => void;
  clearCurrentSession: () => void;

  // Getters
  getSession: (sessionId: string) => ChatSession | undefined;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

/**
 * Generate title from first user message (max 30 chars)
 */
function generateTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "새 채팅";
  
  const text = firstUserMsg.content.trim();
  if (text.length <= 30) return text;
  return text.slice(0, 30) + "...";
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE_KEY);
    const savedCurrentId = localStorage.getItem(CURRENT_SESSION_KEY);

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to parse chat sessions:", e);
      }
    }

    if (savedCurrentId) {
      setCurrentSessionId(savedCurrentId);
    }

    setIsHydrated(true);
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isHydrated]);

  // Save current session ID
  useEffect(() => {
    if (isHydrated) {
      if (currentSessionId) {
        localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
      } else {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
    }
  }, [currentSessionId, isHydrated]);

  // Get current session
  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  // Create a new session
  const createSession = useCallback((): string => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "새 채팅",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);

    return newSession.id;
  }, []);

  // Delete a session
  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If deleting current session, select another or null
      if (currentSessionId === sessionId) {
        setSessions((prev) => {
          const remaining = prev.filter((s) => s.id !== sessionId);
          setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
          return remaining;
        });
      }
    },
    [currentSessionId]
  );

  // Select a session
  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  // Add a message to a session (defaults to current session)
  const addMessage = useCallback(
    (message: Message, sessionId?: string) => {
      const targetId = sessionId || currentSessionId;
      if (!targetId) return;

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== targetId) return session;

          const newMessages = [...session.messages, message];
          const newTitle =
            session.messages.length === 0 && message.role === "user"
              ? generateTitle([message])
              : session.title;

          return {
            ...session,
            messages: newMessages,
            title: newTitle,
            updatedAt: Date.now(),
          };
        })
      );
    },
    [currentSessionId]
  );

  // Update the last message (for streaming)
  const updateLastMessage = useCallback(
    (content: string, sessionId?: string) => {
      const targetId = sessionId || currentSessionId;
      if (!targetId) return;

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== targetId) return session;
          if (session.messages.length === 0) return session;

          const newMessages = [...session.messages];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content,
          };

          return {
            ...session,
            messages: newMessages,
            updatedAt: Date.now(),
          };
        })
      );
    },
    [currentSessionId]
  );

  // Clear current session messages
  const clearCurrentSession = useCallback(() => {
    if (!currentSessionId) return;

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== currentSessionId) return session;
        return {
          ...session,
          messages: [],
          title: "새 채팅",
          updatedAt: Date.now(),
        };
      })
    );
  }, [currentSessionId]);

  // Get a specific session
  const getSession = useCallback(
    (sessionId: string) => sessions.find((s) => s.id === sessionId),
    [sessions]
  );

  const value: ChatContextValue = {
    sessions,
    currentSessionId,
    currentSession,
    createSession,
    deleteSession,
    selectSession,
    addMessage,
    updateLastMessage,
    clearCurrentSession,
    getSession,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}

