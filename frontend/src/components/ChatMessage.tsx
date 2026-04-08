"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, Source } from "@/types/chat";
import ArtifactFrame from "./ArtifactFrame";
import { useChatContext } from "@/context/ChatContext";



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TYPE_ICON: Record<string, React.ReactNode> = {
  "text/html": (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  "application/vnd.ant.mermaid": (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  "image": (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  "image/jpeg": (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  "image/png": (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
};

interface NavProps { current: number; total: number; onPrev: () => void; onNext: () => void; disablePrev: boolean; disableNext: boolean; }
interface Props { message: ChatMessage; onRetry?: () => void; showNav?: NavProps; }

function SourcesAccordion({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sources.map((s, i) => (
            <Link
              key={i}
              href={`/manual?doc=${s.source}&page=${s.page}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all duration-150"
              style={{
                background:  "var(--bg-card)",
                border:      "1px solid var(--border)",
                color:       "var(--text-secondary)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(249,115,22,0.4)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              }}
              title={`Open ${s.source} p.${s.page} in Manual Explorer`}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span style={{ color: "var(--accent)" }}>p.{s.page}</span>
              <span className="opacity-40">·</span>
              <span className="max-w-[160px] truncate">{s.section || s.source}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const ArcIcon = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
    <rect x="4" y="18" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x="12" y="19" width="5" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
    <line x1="17" y1="20" x2="24" y2="13" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="24" cy="13" r="2" fill="#fb923c" />
  </svg>
);

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")        // code blocks
    .replace(/`[^`]+`/g, "")               // inline code
    .replace(/#{1,6}\s+/g, "")             // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")     // bold
    .replace(/\*([^*]+)\*/g, "$1")         // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^[-*+]\s+/gm, "")            // bullets
    .replace(/^\d+\.\s+/gm, "")            // numbered lists
    .replace(/\n{2,}/g, ". ")              // double newlines → pause
    .replace(/\n/g, " ")
    .trim();
}

function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  const toggle = () => {
    if (!("speechSynthesis" in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      onClick={toggle}
      title={speaking ? "Stop speaking" : "Listen to response"}
      className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
      style={speaking ? {
        background: "rgba(249,115,22,0.12)",
        border:     "1px solid rgba(249,115,22,0.3)",
        color:      "#f97316",
      } : {
        background: "var(--bg-card)",
        border:     "1px solid var(--border)",
        color:      "var(--text-muted)",
      }}
    >
      {speaking ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      )}
    </button>
  );
}

function ZoomableView({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const movedRef = useRef(false);

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(s => clamp(s * factor, 0.25, 8));
  }

  function handleClick() {
    if (movedRef.current) return;
    setScale(s => {
      const next = s >= 3 ? 1 : clamp(s * 1.5, 0.25, 8);
      if (next <= 1) setPos({ x: 0, y: 0 });
      return next;
    });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    e.preventDefault();
    movedRef.current = false;
    dragRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    setIsDragging(true);

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      movedRef.current = true;
      setPos({
        x: dragRef.current.px + (ev.clientX - dragRef.current.mx),
        y: dragRef.current.py + (ev.clientY - dragRef.current.my),
      });
    }
    function onUp() {
      setIsDragging(false);
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setTimeout(() => { movedRef.current = false; }, 50);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const cursor = isDragging ? "grabbing" : scale > 1 ? "grab" : "zoom-in";

  return (
    <div
      style={{
        overflow: "hidden",
        cursor,
        userSelect: "none",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onWheel={handleWheel}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <div
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.15s ease-out",
          width: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ChatMessageBubble({ message, onRetry, showNav }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="flex items-center gap-2 max-w-[75%]">
          {/* Message pill — matches Online/Reset header style */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm"
            style={{
              background: "rgba(249,115,22,0.08)",
              border:     "1px solid rgba(249,115,22,0.2)",
              color:      "var(--text-primary)",
            }}
          >
            <span>{message.text}</span>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 animate-fade-up">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.08))",
          border: "1px solid rgba(249,115,22,0.3)",
          color: "#f97316",
        }}
      >
        <ArcIcon />
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">

        {/* Text — always first, it's the answer */}
        <div className="chat-prose mb-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Artifacts — ordered and laid out by type */}
        {message.artifacts && message.artifacts.length > 0 && (() => {
          // Sort: mermaid → image → html (abstract → concrete → interactive)
          const sorted = [...message.artifacts].sort((a, b) => {
            const order = (t: string) =>
              t === "application/vnd.ant.mermaid" ? 0 :
              t.startsWith("image") ? 1 : 2;
            return order(a.type) - order(b.type);
          });

          const mermaidArtifacts = sorted.filter(a => a.type === "application/vnd.ant.mermaid");
          const imageArtifacts   = sorted.filter(a => a.type.startsWith("image"));
          const htmlArtifacts    = sorted.filter(a => a.type === "text/html");

          const ArtifactCard = ({ artifact, i }: { artifact: typeof sorted[0]; i: number }) => {
            const [expanded, setExpanded] = useState(false);   // arrows → full-screen modal
            const [panZoom, setPanZoom]   = useState(false);   // + → inline pan-and-zoom
            const title = artifact.title || (
              artifact.type === "application/vnd.ant.mermaid" ? "Connection Diagram" :
              artifact.type.startsWith("image") ? `Manual p.${artifact.page}` :
              "Interactive"
            );

            return (
              <>
                {/* Inline card */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(249,115,22,0.25)" }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2"
                    style={{
                      background:   "rgba(249,115,22,0.08)",
                      borderBottom: "1px solid rgba(249,115,22,0.15)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#f97316" }}>{TYPE_ICON[artifact.type]}</span>
                      <span className="text-xs font-medium" style={{ color: "#f97316" }}>{title}</span>
                    </div>
                    {/* Arrows → full-screen expand */}
                    <button
                      onClick={() => setExpanded(true)}
                      title="Expand"
                      className="flex items-center justify-center w-5 h-5 rounded transition-opacity opacity-50 hover:opacity-100"
                      style={{ color: "#f97316" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                        <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                      </svg>
                    </button>
                  </div>

                  {/* Content area — plain or pan-zoom */}
                  <div style={{ background: "var(--bg-secondary)", position: "relative" }}>
                    {panZoom && artifact.type !== "text/html" ? (
                      <div style={{ height: "360px" }}>
                        <ZoomableView>
                          <ArtifactFrame artifact={artifact} />
                        </ZoomableView>
                      </div>
                    ) : (
                      <ArtifactFrame artifact={artifact} />
                    )}

                    {/* + / × toggle for pan-zoom (only on non-HTML artifacts) */}
                    {artifact.type !== "text/html" && (
                      <button
                        onClick={() => setPanZoom(v => !v)}
                        title={panZoom ? "Exit zoom" : "Pan & zoom"}
                        className="absolute bottom-2 right-2 flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-all"
                        style={{
                          background: panZoom ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.15)",
                          border: "1px solid rgba(249,115,22,0.4)",
                          color: "#f97316",
                          zIndex: 10,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.4)")}
                        onMouseLeave={e => (e.currentTarget.style.background = panZoom ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.15)")}
                      >{panZoom ? "×" : "+"}</button>
                    )}
                  </div>

                  {/* Hint bar when pan-zoom is active */}
                  {panZoom && artifact.type !== "text/html" && (
                    <div
                      className="text-center text-xs py-1"
                      style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}
                    >
                      Scroll to zoom · Click to zoom in · Drag to pan
                    </div>
                  )}
                </div>

                {/* Full-screen expand modal (arrows only) */}
                {expanded && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
                    onClick={() => setExpanded(false)}
                  >
                    <div
                      className="rounded-xl overflow-hidden w-full max-w-4xl flex flex-col"
                      style={{ border: "1px solid rgba(249,115,22,0.4)", background: "var(--bg-secondary)", height: "85vh" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div
                        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                        style={{ background: "rgba(249,115,22,0.08)", borderBottom: "1px solid rgba(249,115,22,0.15)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span style={{ color: "#f97316" }}>{TYPE_ICON[artifact.type]}</span>
                          <span className="text-sm font-medium" style={{ color: "#f97316" }}>{title}</span>
                        </div>
                        <button
                          onClick={() => setExpanded(false)}
                          className="flex items-center justify-center w-7 h-7 rounded-md transition-opacity opacity-60 hover:opacity-100"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      <div className="overflow-auto flex-1">
                        <ArtifactFrame artifact={artifact} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          };

          return (
            <div className="flex flex-col gap-4 mb-2">
              {/* Mermaid + Image side by side when both present */}
              {(mermaidArtifacts.length > 0 || imageArtifacts.length > 0) && (
                <div className={
                  mermaidArtifacts.length > 0 && imageArtifacts.length > 0
                    ? "grid grid-cols-2 gap-4"
                    : "flex flex-col gap-4"
                }>
                  {mermaidArtifacts.map((a, i) => <ArtifactCard key={a.identifier || i} artifact={a} i={i} />)}
                  {imageArtifacts.map((a, i)   => <ArtifactCard key={a.identifier || i} artifact={a} i={i} />)}
                </div>
              )}
              {/* HTML always full width */}
              {htmlArtifacts.map((a, i) => <ArtifactCard key={a.identifier || i} artifact={a} i={i} />)}
            </div>
          );
        })()}


        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <SourcesAccordion sources={message.sources} />
        )}

        {/* Action bar: nav + speak + copy + retry + feedback — all one line */}
        <div className="mt-2 flex items-center gap-1">
          {showNav && (
            <>
              <button onClick={showNav.onPrev} disabled={showNav.disablePrev} title="Previous response"
                className="flex items-center justify-center w-5 h-5 rounded disabled:opacity-30 transition-opacity"
                style={{ color: "var(--text-muted)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-[11px] tabular-nums select-none" style={{ color: "var(--text-muted)" }}>{showNav.current}/{showNav.total}</span>
              <button onClick={showNav.onNext} disabled={showNav.disableNext} title="Next response"
                className="flex items-center justify-center w-5 h-5 rounded disabled:opacity-30 transition-opacity"
                style={{ color: "var(--text-muted)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <span className="w-px h-3 mx-0.5" style={{ background: "var(--border)" }} />
            </>
          )}
          <SpeakButton text={message.text} />
          <CopyButton text={message.text} />
          {onRetry && (
            <button onClick={onRetry} title="Retry response"
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.98"/>
              </svg>
            </button>
          )}
          <FeedbackButtons message={message} />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      title="Copy response"
      className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
      style={{
        background: copied ? "rgba(34,197,94,0.1)" : "var(--bg-card)",
        border:     copied ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--border)",
        color:      copied ? "#4ade80" : "var(--text-muted)",
      }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

function FeedbackButtons({ message }: { message: ChatMessage }) {
  const { sessionId } = useChatContext();
  const [voted, setVoted] = useState<1 | -1 | null>(null);

  const submit = async (rating: 1 | -1) => {
    if (voted !== null) return;
    setVoted(rating);
    try {
      await fetch(`${API_URL}/api/feedback`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message_id: message.id,
          query:      message.userQuery ?? "",
          response:   message.text,
          rating,
        }),
      });
    } catch { /* non-fatal */ }
  };

  const btnStyle = (active: boolean, positive: boolean) => ({
    background: active
      ? positive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"
      : "var(--bg-card)",
    border: active
      ? positive ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)"
      : "1px solid var(--border)",
    color: active
      ? positive ? "#4ade80" : "#f87171"
      : "var(--text-muted)",
  });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => submit(1)}
        disabled={voted !== null}
        title="Good response"
        className="flex items-center justify-center w-6 h-6 rounded-md text-xs transition-all disabled:cursor-default"
        style={btnStyle(voted === 1, true)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button
        onClick={() => submit(-1)}
        disabled={voted !== null}
        title="Bad response"
        className="flex items-center justify-center w-6 h-6 rounded-md text-xs transition-all disabled:cursor-default"
        style={btnStyle(voted === -1, false)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      </button>
    </div>
  );
}
