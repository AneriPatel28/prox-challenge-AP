"use client";

import { useRef, useEffect } from "react";
import { useChatContext } from "@/context/ChatContext";
import ChatThread from "./ChatThread";
import ChatInput from "./ChatInput";
import ThinkingIndicator from "./ThinkingIndicator";
import QuickTopics from "./QuickTopics";

interface Props {
  initialQuery?: string;
}

export default function ChatApp({ initialQuery }: Props) {
  const { turns, thinkingSteps, isStreaming, error, sendMessage, stopStreaming, clearError } = useChatContext();
  const didSendInitial = useRef(false);

  useEffect(() => {
    if (initialQuery && !didSendInitial.current) {
      didSendInitial.current = true;
      sendMessage(initialQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const isEmpty = turns.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <QuickTopics onSelect={sendMessage} />
        ) : (
          <ChatThread turns={turns} />
        )}
      </div>

      {isStreaming && thinkingSteps.length > 0 && (
        <ThinkingIndicator steps={thinkingSteps} />
      )}

      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 rounded-lg text-sm animate-fade-up"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          {error}
          <button onClick={clearError} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="p-4 pt-0">
        <ChatInput onSend={sendMessage} onStop={stopStreaming} disabled={isStreaming} />
      </div>
    </div>
  );
}
