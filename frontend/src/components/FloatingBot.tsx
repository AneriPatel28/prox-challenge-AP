"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const FAQS = [
  { q: "What pages are on this site?", a: "There are 4 pages: Home, AI Assistant (chat), Manual Explorer, and AI Scorecard. Pick one below to jump straight there.", links: [{ label: "AI Assistant →", href: "/chat" }, { label: "Manual Explorer →", href: "/manual" }, { label: "AI Scorecard →", href: "/eval" }] },
  { q: "What can the AI Assistant do?", a: "It answers any question about the OmniPro 220 — setup, settings, troubleshooting, specs, polarity, duty cycle. It reads the full owner's manual so you don't have to.", link: { label: "Open AI Assistant →", href: "/chat" } },
  { q: "Where are the manuals?",        a: "Manual Explorer has all three manuals — Owner's Manual, Quick Start Guide, and Selection Chart. You can browse page by page.", link: { label: "Open Manual Explorer →", href: "/manual" } },
  { q: "What is the AI Scorecard?",     a: "It shows how the AI was tested — 65 real questions scored across 8 dimensions like accuracy, completeness, and tone. Currently passing 65/65.", link: { label: "View AI Scorecard →", href: "/eval" } },
];

interface Msg { role: "bot" | "user"; text: string; link?: { label: string; href: string }; links?: { label: string; href: string }[] }

const GREETING: Msg = {
  role: "bot",
  text: "Hey! 👋 I'm the site guide — I'll help you find your way around. I'm separate from the AI Assistant. Pick a question or ask me anything about the site.",
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

    // Rule-based keyword matching — site navigation only
    const t = text.toLowerCase();
    let reply: Msg;

    // ── Pages & navigation ────────────────────────────────────────────────────
    if (t.includes("home") || t.includes("main page") || t.includes("landing") || t.includes("back to")) {
      reply = { role: "bot", text: "The home page gives you an overview of the site — quick topics, process cards, and links to all sections.", link: { label: "Go to Home →", href: "/" } };

    } else if (t.includes("page") && (t.includes("all") || t.includes("pages") || t.includes("what") || t.includes("which"))) {
      reply = { role: "bot", text: "The site has 4 pages: Home, AI Assistant, Manual Explorer, and AI Scorecard.", links: [{ label: "AI Assistant →", href: "/chat" }, { label: "Manual Explorer →", href: "/manual" }, { label: "AI Scorecard →", href: "/eval" }] };

    // ── AI Assistant ──────────────────────────────────────────────────────────
    } else if (t.includes("chat") || t.includes("ai assistant") || t.includes("ask") || (t.includes("question") && !t.includes("score")) || t.includes("assistant")) {
      reply = { role: "bot", text: "The AI Assistant answers anything about the OmniPro 220 — setup, settings, troubleshooting, specs, polarity, duty cycle. It reads the full owner's manual for you.", link: { label: "Open AI Assistant →", href: "/chat" } };

    // ── Manual Explorer ───────────────────────────────────────────────────────
    } else if (t.includes("manual") || t.includes("pdf") || t.includes("document") || t.includes("owner") || t.includes("quick start") || t.includes("selection chart") || t.includes("page") || t.includes("browse")) {
      reply = { role: "bot", text: "Manual Explorer has all three manuals — Owner's Manual, Quick Start Guide, and Selection Chart. Browse page by page or jump to a section.", link: { label: "Open Manual Explorer →", href: "/manual" } };

    // ── AI Scorecard / Eval ───────────────────────────────────────────────────
    } else if (t.includes("score") || t.includes("eval") || t.includes("test") || t.includes("accuracy") || t.includes("how good") || t.includes("benchmark") || t.includes("pass") || t.includes("rating") || t.includes("dimension") || t.includes("judge")) {
      reply = { role: "bot", text: "The AI Scorecard shows how the AI was tested — 65 real questions scored across 8 dimensions: factual accuracy, completeness, tone, safety, and more. Currently 65/65 passing.", link: { label: "View AI Scorecard →", href: "/eval" } };

    // ── Welding processes ─────────────────────────────────────────────────────
    } else if (t.includes("mig") || t.includes("tig") || t.includes("stick") || t.includes("flux") || t.includes("fcaw") || t.includes("process") || t.includes("weld")) {
      reply = { role: "bot", text: "The OmniPro 220 supports MIG, TIG, Stick, and Flux-Core (FCAW). The AI Assistant knows setup and settings for all four.", link: { label: "Ask the AI →", href: "/chat" } };

    // ── Settings & specs ──────────────────────────────────────────────────────
    } else if (t.includes("setting") || t.includes("voltage") || t.includes("wire speed") || t.includes("amp") || t.includes("spec") || t.includes("duty cycle") || t.includes("gas") || t.includes("polarity")) {
      reply = { role: "bot", text: "For settings like voltage, wire speed, or duty cycle — the AI Assistant gives exact numbers based on your process, material, and thickness.", link: { label: "Get settings →", href: "/chat" } };

    // ── Troubleshooting ───────────────────────────────────────────────────────
    } else if (t.includes("troubl") || t.includes("problem") || t.includes("issue") || t.includes("fix") || t.includes("not work") || t.includes("porosity") || t.includes("spatter") || t.includes("arc") || t.includes("broken")) {
      reply = { role: "bot", text: "For troubleshooting — describe your problem to the AI Assistant. It'll walk you through the diagnosis step by step.", link: { label: "Open AI Assistant →", href: "/chat" } };

    // ── What is this site / about ─────────────────────────────────────────────
    } else if (t.includes("what is") || t.includes("what's this") || t.includes("about") || t.includes("site") || t.includes("app") || t.includes("omnipro") || t.includes("220") || t.includes("vulcan") || t.includes("harbor")) {
      reply = { role: "bot", text: "This site is an AI-powered assistant for the Vulcan OmniPro 220 welder. It reads the full owner's manual so you can ask questions in plain English instead of hunting through 50 pages of PDF." };

    // ── What is this bot ──────────────────────────────────────────────────────
    } else if (t.includes("who are you") || t.includes("what are you") || t.includes("you") || t.includes("bot") || t.includes("guide") || t.includes("navigate") || t.includes("different")) {
      reply = { role: "bot", text: "I'm the Site Guide — I only help you navigate this website. I'm separate from the AI Assistant, which actually answers welding questions. Think of me as the directory.", link: { label: "Open AI Assistant →", href: "/chat" } };

    // ── Feedback ──────────────────────────────────────────────────────────────
    } else if (t.includes("feedback") || t.includes("review") || t.includes("opinion") || t.includes("improve") || t.includes("suggest") || t.includes("report")) {
      reply = { role: "bot", text: "You can leave feedback using the thumbs up/down on any AI response in the chat. Your input helps improve the AI.", link: { label: "Open AI Assistant →", href: "/chat" } };

    // ── Cost / sign-up ────────────────────────────────────────────────────────
    } else if (t.includes("free") || t.includes("cost") || t.includes("price") || t.includes("pay") || t.includes("sign up") || t.includes("account") || t.includes("login") || t.includes("register")) {
      reply = { role: "bot", text: "Completely free — no sign-up, no account, no login needed. Just open the chat and start asking.", link: { label: "Open AI Assistant →", href: "/chat" } };

    // ── Help / general ────────────────────────────────────────────────────────
    } else if (t.includes("help") || t.includes("how do i") || t.includes("how to") || t.includes("where")) {
      reply = { role: "bot", text: "Here's what's on the site:", links: [{ label: "AI Assistant →", href: "/chat" }, { label: "Manual Explorer →", href: "/manual" }, { label: "AI Scorecard →", href: "/eval" }] };

    // ── Default ───────────────────────────────────────────────────────────────
    } else {
      reply = { role: "bot", text: "I only handle site navigation — for welding questions, the AI Assistant is what you want.", link: { label: "Open AI Assistant →", href: "/chat" } };
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
                  {m.links && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {m.links.map(l => (
                        <Link key={l.href} href={l.href}
                          className="flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
                          style={{ color: "#f97316" }}>
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-col gap-1">
              {FAQS.map(f => (
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
