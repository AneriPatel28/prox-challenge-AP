"use client";

import { useEffect, useRef } from "react";
import type { ConversationTurn } from "@/types/chat";
import ChatMessageBubble from "./ChatMessage";
import { useChatContext } from "@/context/ChatContext";

export default function ChatThread({ turns }: { turns: ConversationTurn[] }) {
  const { retryTurn, setActiveIndex, isStreaming } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, turns[turns.length - 1]?.responses.length]);

  return (
    <div className="px-4 py-6 space-y-6 max-w-3xl mx-auto">
      {turns.map((turn) => {
        const response    = turn.responses[turn.activeIndex];
        const total       = turn.responses.length;
        const current     = turn.activeIndex + 1;
        const showNav     = total > 1;
        const isLastTurn  = turn === turns[turns.length - 1];

        return (
          <div key={turn.id} className="space-y-4">
            {/* User message — shown once regardless of retries */}
            <ChatMessageBubble message={turn.userMsg} />

            {/* Active assistant response */}
            {response && (
              <div>
                <ChatMessageBubble
                  message={response}
                  onRetry={isLastTurn && !isStreaming ? () => retryTurn(turn.id) : undefined}
                  showNav={showNav ? { current, total, onPrev: () => setActiveIndex(turn.id, turn.activeIndex - 1), onNext: () => setActiveIndex(turn.id, turn.activeIndex + 1), disablePrev: turn.activeIndex === 0, disableNext: turn.activeIndex === total - 1 } : undefined}
                />
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
