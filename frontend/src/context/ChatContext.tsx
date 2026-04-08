"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, ConversationTurn, ThinkingStep, SSEEvent } from "@/types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatState {
  turns:           ConversationTurn[];
  thinkingSteps:   ThinkingStep[];
  isStreaming:     boolean;
  error:           string | null;
  sessionId:       string;
  sendMessage:     (text: string) => Promise<void>;
  retryTurn:       (turnId: string) => Promise<void>;
  stopStreaming:   () => void;
  setActiveIndex:  (turnId: string, index: number) => void;
  clearError:      () => void;
  clearMessages:   () => void;
}

const ChatContext = createContext<ChatState | null>(null);

/** Flatten turns into [{role, content}] history for the API, up to (but not including) a given turnId. */
function buildHistory(turns: ConversationTurn[], stopBeforeTurnId?: string) {
  const pairs: { role: string; content: string }[] = [];
  for (const turn of turns) {
    if (turn.id === stopBeforeTurnId) break;
    pairs.push({ role: "user",      content: turn.userMsg.text });
    const active = turn.responses[turn.activeIndex];
    if (active) pairs.push({ role: "assistant", content: active.text });
  }
  return pairs;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns]                 = useState<ConversationTurn[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [isStreaming, setIsStreaming]     = useState(false);
  const [error, setError]                = useState<string | null>(null);

  const sessionIdRef  = useRef<string>(uuidv4());
  const thinkingRef   = useRef<ThinkingStep[]>([]);
  const turnsRef      = useRef<ConversationTurn[]>([]);
  const abortRef      = useRef<AbortController | null>(null);

  // Keep refs in sync so callbacks always see latest state
  useEffect(() => { thinkingRef.current = thinkingSteps; }, [thinkingSteps]);
  useEffect(() => { turnsRef.current = turns; },           [turns]);

  /** Core streaming helper — calls API and pipes answer into a specific turn. */
  const stream = useCallback(async (
    userText:   string,
    history:    { role: string; content: string }[],
    targetTurnId: string,
  ) => {
    setIsStreaming(true);
    setThinkingSteps([]);

    // ID for the in-progress assistant message (created on first delta)
    let streamingMsgId: string | null = null;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abort.signal,
        body: JSON.stringify({
          message:    userText,
          session_id: sessionIdRef.current,
          history:    history.slice(-4),
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: SSEEvent;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "heartbeat") continue;

          if (event.type === "thinking") {
            setThinkingSteps(prev => [...prev, { message: event.message, ts: Date.now() }]);
          }

          // First delta → create the message bubble with empty text
          // Subsequent deltas → append to it
          if (event.type === "delta") {
            if (!streamingMsgId) {
              streamingMsgId = uuidv4();
              const newMsg: ChatMessage = {
                id:        streamingMsgId,
                role:      "assistant",
                text:      event.text ?? "",
                artifacts: [],
                sources:   [],
                thinking:  thinkingRef.current,
                userQuery: userText,
              };
              setTurns(prev => prev.map(t => {
                if (t.id !== targetTurnId) return t;
                const responses = [...t.responses, newMsg];
                return { ...t, responses, activeIndex: responses.length - 1 };
              }));
            } else {
              const mid = streamingMsgId;
              setTurns(prev => prev.map(t => {
                if (t.id !== targetTurnId) return t;
                return {
                  ...t,
                  responses: t.responses.map(r =>
                    r.id === mid ? { ...r, text: r.text + (event.text ?? "") } : r
                  ),
                };
              }));
            }
          }

          // answer → finalize: attach artifacts + sources to the streamed message
          if (event.type === "answer") {
            if (streamingMsgId) {
              const mid = streamingMsgId;
              setTurns(prev => prev.map(t => {
                if (t.id !== targetTurnId) return t;
                return {
                  ...t,
                  responses: t.responses.map(r =>
                    r.id === mid
                      ? { ...r, text: event.text, artifacts: event.artifacts, sources: event.sources }
                      : r
                  ),
                };
              }));
            } else {
              // No deltas were emitted (empty response) — create message directly
              const assistantMsg: ChatMessage = {
                id:        uuidv4(),
                role:      "assistant",
                text:      event.text,
                artifacts: event.artifacts,
                sources:   event.sources,
                thinking:  thinkingRef.current,
                userQuery: userText,
              };
              setTurns(prev => prev.map(t => {
                if (t.id !== targetTurnId) return t;
                const responses = [...t.responses, assistantMsg];
                return { ...t, responses, activeIndex: responses.length - 1 };
              }));
            }
          }

          if (event.type === "error") setError(event.message);

          if (event.type === "done") {
            setIsStreaming(false);
            setThinkingSteps([]);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User stopped — not an error, just clean up
      } else {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
      setIsStreaming(false);
      setThinkingSteps([]);
    } finally {
      abortRef.current = null;
    }
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setThinkingSteps([]);
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isStreaming) return;
    setError(null);

    const turnId  = uuidv4();
    const userMsg: ChatMessage = { id: uuidv4(), role: "user", text: userText };
    const newTurn: ConversationTurn = { id: turnId, userMsg, responses: [], activeIndex: 0 };

    setTurns(prev => [...prev, newTurn]);

    const history = buildHistory(turnsRef.current); // all prior turns
    await stream(userText, history, turnId);
  }, [isStreaming, stream]);

  const retryTurn = useCallback(async (turnId: string) => {
    if (isStreaming) return;
    setError(null);

    const turn = turnsRef.current.find(t => t.id === turnId);
    if (!turn) return;

    // History = all turns before this one, flattened
    const history = buildHistory(turnsRef.current, turnId);
    await stream(turn.userMsg.text, history, turnId);
  }, [isStreaming, stream]);

  const setActiveIndex = useCallback((turnId: string, index: number) => {
    setTurns(prev => prev.map(t =>
      t.id === turnId ? { ...t, activeIndex: index } : t
    ));
  }, []);

  const clearMessages = useCallback(() => {
    setTurns([]);
    setThinkingSteps([]);
    setError(null);
    sessionIdRef.current = uuidv4();
  }, []);

  return (
    <ChatContext.Provider value={{
      turns, thinkingSteps, isStreaming, error,
      sessionId: sessionIdRef.current,
      sendMessage, retryTurn, stopStreaming, setActiveIndex,
      clearError: () => setError(null), clearMessages,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
