"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const FAQS = [
  { q: "What is this?",             a: "This is an AI assistant for the Vulcan OmniPro 220 welder. Ask it anything about setup, settings, or troubleshooting — it reads the full owner's manual for you." },
  { q: "Where are the manuals?",    a: "Click Manual Explorer in the sidebar. You'll find the Owner's Manual, Quick Start Guide, and Selection Chart all in one place." },
  { q: "What processes does it support?", a: "The OmniPro 220 supports MIG, TIG, Stick, and Flux-Core (FCAW). The AI knows the setup and settings for all four." },
  { q: "Is it free to use?",        a: "Yes! Just open the chat and start asking. No sign-up needed." },
];

interface Msg { role: "bot" | "user"; text: string; link?: { label: string; href: string } }

const GREETING: Msg = {
  role: "bot",
  text: "Hey! 👋 I can help you find your way around. Ask me anything about the site, or pick a question below.",
};

export default function FloatingBot() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Simple keyword matching
    const t = text.toLowerCase();
    let reply: Msg;

    if (t.includes("manual") || t.includes("pdf") || t.includes("document")) {
      reply = { role: "bot", text: "You can browse all three manuals in the Manual Explorer — Owner's Manual, Quick Start Guide, and Selection Chart.", link: { label: "Open Manual Explorer →", href: "/manual" } };
    } else if (t.includes("chat") || t.includes("ask") || t.includes("question") || t.includes("help")) {
      reply = { role: "bot", text: "Head to the AI Assistant and type your question. It knows everything about setup, troubleshooting, settings, and specs.", link: { label: "Open AI Assistant →", href: "/chat" } };
    } else if (t.includes("mig") || t.includes("tig") || t.includes("stick") || t.includes("flux") || t.includes("weld")) {
      reply = { role: "bot", text: "The OmniPro 220 supports MIG, TIG, Stick, and Flux-Core. The AI Assistant can walk you through setup for any of them!", link: { label: "Ask the AI →", href: "/chat" } };
    } else if (t.includes("setting") || t.includes("voltage") || t.includes("speed") || t.includes("amp")) {
      reply = { role: "bot", text: "For specific settings like voltage or wire speed, the AI Assistant gives you exact numbers based on your material and thickness.", link: { label: "Get settings →", href: "/chat" } };
    } else if (t.includes("what") && (t.includes("this") || t.includes("site") || t.includes("app"))) {
      reply = { role: "bot", text: "This is an AI-powered assistant for the Vulcan OmniPro 220 welder. It reads the full manual so you don't have to — just ask your question!" };
    } else {
      reply = { role: "bot", text: "I'm not sure about that one! Try asking the AI Assistant — it knows the full owner's manual.", link: { label: "Open AI Assistant →", href: "/chat" } };
    }

    setTimeout(() => setMessages(prev => [...prev, reply]), 400);
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
        {/* Tooltip — only on hover, only when closed */}
        {!open && hovered && (
          <div className="animate-fade-up px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
            Need help?
          </div>
        )}

        <button onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
          style={{
            background: open ? "var(--bg-secondary)" : "#f97316",
            border: open ? "1px solid var(--border)" : "none",
            color: open ? "var(--text-muted)" : "white",
            boxShadow: open ? "none" : "0 0 24px rgba(249,115,22,0.4)",
          }}>
          {open ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="18" width="12" height="5" rx="2" fill="white" opacity="0.9"/>
              <rect x="13" y="19.5" width="5" height="3" rx="1" fill="white" opacity="0.6"/>
              <line x1="18" y1="21" x2="27" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="27" cy="12" r="3" fill="white"/>
            </svg>
          )}
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-80 rounded-2xl overflow-hidden animate-fade-up shadow-2xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <rect x="3" y="18" width="12" height="5" rx="2" fill="currentColor" opacity="0.8"/>
                <rect x="13" y="19.5" width="5" height="3" rx="1" fill="currentColor" opacity="0.5"/>
                <line x1="18" y1="21" x2="27" y2="12" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="27" cy="12" r="3" fill="#fb923c"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Site Guide</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Ask me anything about this site</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px]" style={{ color: "#4ade80" }}>Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 p-3 overflow-y-auto" style={{ maxHeight: "280px" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={m.role === "user" ? {
                      background: "rgba(249,115,22,0.12)",
                      border: "1px solid rgba(249,115,22,0.2)",
                      color: "var(--text-primary)",
                    } : {
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}>
                    {m.text}
                  </div>
                  {m.link && (
                    <Link href={m.link.href}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
                      style={{ color: "#f97316" }}>
                      {m.link.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-col gap-1">
              {FAQS.slice(0, 3).map(f => (
                <button key={f.q} onClick={() => send(f.q)}
                  className="text-left text-xs px-3 py-2 rounded-lg transition-all"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}>
                  {f.q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder="Ask about the site…"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            <button onClick={() => send(input)} disabled={!input.trim()}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
              style={{ background: "#f97316", color: "white" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
