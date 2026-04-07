"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatApp from "@/components/ChatApp";
import ThemeToggle from "@/components/ThemeToggle";
import { useChatContext } from "@/context/ChatContext";

function ChatContent() {
  const searchParams   = useSearchParams();
  const initialQuery   = searchParams.get("q") || "";
  const [collapsed, setCollapsed] = useState(false);
  const { clearMessages, turns, isStreaming } = useChatContext();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "none", background: "var(--bg-secondary)", position: "relative" }}
        >
          {/* Orange accent line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)" }} />
          <div />
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
              style={{
                background: "rgba(34,197,94,0.1)",
                border:     "1px solid rgba(34,197,94,0.25)",
                color:      "#4ade80",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </div>
            {turns.length > 0 && !isStreaming && (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all"
                style={{
                  background: "transparent",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-muted)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                }}
                title="Clear conversation"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Reset
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatApp initialQuery={initialQuery} />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <ChatContent />
    </Suspense>
  );
}
