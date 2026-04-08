"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackModal from "@/components/FeedbackModal";
import FloatingBot from "@/components/FloatingBot";

const QUICK_TOPICS = [
  "What's the duty cycle at 200A on 240V?",
  "How do I set up MIG welding for 1/4\" steel?",
  "Wire isn't feeding smoothly — what do I check?",
  "What polarity for TIG welding?",
  "Getting porosity in my welds, why?",
  "How to connect the TIG torch?",
  "What gas do I need for MIG welding?",
  "Flux-cored polarity — positive or negative?",
  "Recommended wire speed for 3/16\" steel?",
  "How do I reduce spatter?",
  "Can I weld stainless with this machine?",
  "What's the max output on 120V?",
];

const PROCESSES = [
  {
    id: "mig",
    name: "MIG",
    full: "Gas Metal Arc",
    color: "#f97316",
    amps: [
      { label: "120V", val: 140, max: 220 },
      { label: "240V", val: 220, max: 220 },
    ],
    desc: "The easiest process to learn. Uses a wire that feeds automatically while you hold the trigger. Great for mild steel, fast welds, and beginners.",
    facts: ["Wire: .023–.035\" solid", "Gas: 75% Ar / 25% CO₂", "Polarity: DCEP"],
    q: "How do I set up MIG welding on the OmniPro 220?",
  },
  {
    id: "tig",
    name: "TIG",
    full: "Gas Tungsten Arc",
    color: "#38bdf8",
    amps: [
      { label: "120V", val: 90, max: 220 },
      { label: "240V", val: 200, max: 220 },
    ],
    desc: "The most precise process. You control the filler rod with one hand and the torch with the other. Best for thin metal and clean welds.",
    facts: ["Tungsten: 1/16\"–1/8\"", "Gas: 100% Argon", "Polarity: DCEN"],
    q: "What's the TIG setup and polarity for the OmniPro 220?",
  },
  {
    id: "stick",
    name: "STICK",
    full: "Shielded Metal Arc",
    color: "#a78bfa",
    amps: [
      { label: "120V", val: 100, max: 220 },
      { label: "240V", val: 160, max: 220 },
    ],
    desc: "The toughest process — works outdoors, in wind, even on rusty metal. Uses a coated rod that burns as you weld. No gas bottle needed.",
    facts: ["Rod: 3/32\"–1/8\" electrode", "No shielding gas", "Polarity: DCEP or DCEN"],
    q: "How do I set up stick welding on the OmniPro 220?",
  },
  {
    id: "fcaw",
    name: "FCAW",
    full: "Flux-Cored",
    color: "#34d399",
    amps: [
      { label: "120V", val: 140, max: 220 },
      { label: "240V", val: 220, max: 220 },
    ],
    desc: "Like MIG but the wire is hollow and filled with flux. Self-shielded means no gas bottle. Great for outdoor work and thicker steel.",
    facts: ["Wire: .030\"–.045\" flux-core", "Self-shielded (no gas)", "Polarity: DCEN"],
    q: "What polarity and settings for flux-cored welding?",
  },
];

const chamfer = (px = 12) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`;

export default function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";
  const [scrolled, setScrolled] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [autoFlipId, setAutoFlipId] = useState<string | null>(null);
  const isHoveringRef = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = PROCESSES.map(p => p.id);
    let active = true;
    let intervalId: ReturnType<typeof setInterval>;

    const flip = () => {
      if (!active || isHoveringRef.current) return;
      setAutoFlipId(ids[indexRef.current]);
      setTimeout(() => { if (active) setAutoFlipId(null); }, 2000);
      indexRef.current = (indexRef.current + 1) % ids.length;
    };

    const initial = setTimeout(() => {
      if (!active) return;
      flip();
      intervalId = setInterval(flip, 5000);
    }, 2000);

    return () => { active = false; clearTimeout(initial); clearInterval(intervalId); };
  }, []);

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* Nav — minimal, just theme toggle floating top-right */}
      <nav className="fixed top-0 right-0 z-50 flex items-center px-5 py-3">
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <section className="relative w-full overflow-hidden" style={{ height: "100vh", minHeight: "600px" }}>
        <div className="absolute inset-0 overflow-hidden">
          <img src="/product-inside.webp" alt="" className="ken-burns-img absolute inset-0 w-full h-full object-cover" style={{ imageRendering: "crisp-edges", objectPosition: "center 60%" }} />
          <div className="absolute inset-0 hero-gradient-bottom" />
          <div className="absolute inset-0 hero-gradient-side" />
        </div>

        <div className="relative z-10 flex flex-col items-start justify-center h-full px-8 md:px-16 max-w-5xl">
          <div className="mb-2">
            <span className="text-xs font-mono font-bold tracking-[0.3em] uppercase" style={{ color: "#f97316" }}>
              Vulcan Series
            </span>
          </div>

          <h1 className="mb-2 leading-none font-black tracking-tight"
            style={{ fontSize: "clamp(4rem,10vw,8rem)", color: "var(--hero-heading)", textShadow: "0 2px 20px rgba(0,0,0,0.4), 0 8px 40px rgba(0,0,0,0.2)" }}>
            OMNIPRO
          </h1>

          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-black leading-none"
              style={{
                fontSize: "clamp(3rem,8vw,6rem)",
                background: "linear-gradient(135deg,#f97316 0%,#fb923c 40%,#fbbf24 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              220
            </span>
            <span className="text-xs font-bold tracking-[0.2em] uppercase px-2.5 py-1"
              style={{
                clipPath: chamfer(5),
                background: "var(--hero-badge-bg)",
                border: "1px solid var(--hero-badge-border)",
                color: "var(--hero-badge-text)",
              }}>
              AI Assistant
            </span>
          </div>

          <p className="text-base mb-8 max-w-md leading-relaxed" style={{ color: "var(--hero-sub)" }}>
            Ask anything about your welder. Setup, troubleshooting, settings — straight from the owner&apos;s manual.
          </p>

        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: "linear-gradient(to bottom, transparent, var(--bg-primary))" }} />

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10 transition-all duration-500"
          style={{ opacity: scrolled ? 0 : 1, pointerEvents: scrolled ? "none" : "auto", cursor: "default" }}
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}>
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--hero-scroll)" }}>scroll</span>
          <div className="flex flex-col items-center gap-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="animate-bounce" style={{ color: "rgba(249,115,22,0.7)", animationDelay: "0ms" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="animate-bounce" style={{ color: "rgba(249,115,22,0.35)", animationDelay: "150ms" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Quick CTAs */}
      <section className="px-6 md:px-12 pt-4 pb-4 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">

          {/* Chat card */}
          <Link href="/chat"
            className="cta-card-orange relative flex flex-col overflow-hidden transition-all duration-300"
            style={{ clipPath: chamfer(14), background: isLight ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.05)", border: `1px solid ${isLight ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.15)"}`, minHeight: "140px", boxShadow: isLight ? "0 4px 20px rgba(249,115,22,0.12), 0 1px 4px rgba(0,0,0,0.06)" : "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(249,115,22,0.18)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.4)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(249,115,22,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isLight ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = isLight ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.15)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = isLight ? "0 4px 20px rgba(249,115,22,0.12)" : "none"; }}>
            {/* Decorative glow blob */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)" }} />
            {/* Decorative dots pattern */}
            <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none opacity-20"
              style={{ backgroundImage: "radial-gradient(circle, #f97316 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
            <div className="relative flex flex-col justify-between h-full p-5 gap-4">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}>
                  AI Powered
                </span>
              </div>
              <div>
                <p className="text-lg font-black tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>Start Chatting</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Ask setup questions, get troubleshooting help, or find the right settings — instantly.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#f97316" }}>
                Ask a question
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </div>
          </Link>

          {/* Manual card */}
          <Link href="/manual"
            className="cta-card-blue relative flex flex-col overflow-hidden transition-all duration-300"
            style={{ clipPath: chamfer(14), background: isLight ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.09)", border: `1px solid ${isLight ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.22)"}`, minHeight: "140px", boxShadow: isLight ? "0 4px 20px rgba(56,189,248,0.12), 0 1px 4px rgba(0,0,0,0.06)" : "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.2)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,189,248,0.45)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(56,189,248,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isLight ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.09)"; (e.currentTarget as HTMLElement).style.borderColor = isLight ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.22)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = isLight ? "0 4px 20px rgba(56,189,248,0.12)" : "none"; }}>
            {/* Decorative glow blob */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)" }} />
            {/* Decorative lines */}
            <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none opacity-10"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #38bdf8 0, #38bdf8 1px, transparent 0, transparent 50%)", backgroundSize: "8px 8px" }} />
            <div className="relative flex flex-col justify-between h-full p-5 gap-4">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
                  51 Pages
                </span>
              </div>
              <div>
                <p className="text-lg font-black tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>Owner Manual</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Full specs, wiring diagrams, safety instructions, and maintenance guide — all in one place.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#38bdf8" }}>
                Browse docs
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </div>
          </Link>

        </div>
      </section>

      {/* Process tiles */}
      <section className="process-section px-6 md:px-12 py-16 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Welding Processes</p>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Four processes, one machine
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROCESSES.map(proc => <ProcessTile key={proc.id} proc={proc} onAsk={go} isLight={isLight} autoFlip={autoFlipId === proc.id} onHoverStart={() => { isHoveringRef.current = true; setAutoFlipId(null); }} onHoverEnd={() => { isHoveringRef.current = false; }} />)}
        </div>
      </section>

      {/* Quick Questions marquee */}
      <section className="pb-2 overflow-hidden">
        <div className="flex items-center gap-4 px-6 md:px-12 mb-4">
          <span className="text-xs font-mono font-semibold tracking-widest uppercase flex-shrink-0" style={{ color: "#f97316" }}>
            Quick Questions :
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>
        <div className="relative overflow-hidden"
          style={{ maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
          <div className="flex marquee-track-reverse gap-3 w-max"
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.animationPlayState = "running"}>
            {[...QUICK_TOPICS, ...QUICK_TOPICS].map((q, i) => (
              <button key={i} onClick={() => go(q)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs flex-shrink-0 transition-all"
                style={{
                  clipPath: chamfer(6),
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.4)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  style={{ color: "#f97316", flexShrink: 0 }}>
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs pl-16" style={{ color: "var(--text-muted)" }}>OmniPro 220 AI — powered by Claude</span>
        <div className="flex items-center gap-2">
          {/* AI Scorecard */}
          <ScorecardBubble />
          {/* About */}
          <AboutBubble />
          {/* Feedback */}
          <FeedbackBubble onOpen={() => setFeedbackOpen(true)} />
        </div>
      </footer>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <FloatingBot />
    </div>
  );
}

function FeedbackBubble({ onOpen }: { onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <button
        onClick={onOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
        style={{
          color: hovered ? "var(--text-secondary)" : "var(--text-muted)",
          border: `1px solid ${hovered ? "var(--border)" : "transparent"}`,
        }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Feedback
      </button>
      <div className="absolute bottom-10 right-0 w-56 rounded-2xl p-4 shadow-2xl transition-all duration-200"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: hovered ? 1 : 0, transform: hovered ? "translateY(0)" : "translateY(6px)", zIndex: 50, pointerEvents: hovered ? "auto" : "none" }}>
        <div className="absolute -bottom-2 right-4 w-4 h-4 rotate-45"
          style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} />
        <p className="text-xs font-bold mb-1.5" style={{ color: "#4ade80" }}>We&apos;d love to hear from you!</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Tell us what&apos;s working, what&apos;s missing, or how we can make this better for you.
        </p>
        <button onClick={onOpen} className="text-[10px] mt-2.5 font-semibold transition-opacity hover:opacity-70" style={{ color: "#4ade80" }}>
          Click to share →
        </button>
      </div>
    </div>
  );
}

function ScorecardBubble() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => router.push("/eval#end")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
        style={{
          color: open ? "var(--text-secondary)" : "var(--text-muted)",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
        }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        AI Scorecard
      </button>
      <div className="absolute bottom-10 right-0 w-64 rounded-2xl p-4 shadow-2xl transition-all duration-200 pointer-events-none"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(6px)", zIndex: 50 }}>
        <div className="absolute -bottom-2 right-4 w-4 h-4 rotate-45"
          style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} />
        <p className="text-xs font-bold mb-2" style={{ color: "#a855f7" }}>LLM-as-judge evaluation</p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
          65 real questions a garage welder would ask — scored across 8 dimensions by Claude Haiku acting as judge.
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            "Factual accuracy & safety awareness",
            "Completeness across text + artifacts",
            "Tone, relevance & source citation",
          ].map(tip => (
            <div key={tip} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#a855f7" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tip}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-3 font-semibold" style={{ color: "#a855f7" }}>Click to view →</p>
      </div>
    </div>
  );
}

function AboutBubble() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
        style={{
          color: open ? "var(--text-secondary)" : "var(--text-muted)",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
        }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        About
      </button>
      <div className="absolute bottom-10 right-0 w-64 rounded-2xl p-4 shadow-2xl transition-all duration-200 pointer-events-none"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(6px)", zIndex: 50 }}>
        <div className="absolute -bottom-2 right-4 w-4 h-4 rotate-45"
          style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} />
        <p className="text-xs font-bold mb-2" style={{ color: "#f97316" }}>What is this?</p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
          An AI assistant that knows your <strong style={{ color: "var(--text-primary)" }}>Vulcan OmniPro 220</strong> inside out. Ask anything — it reads the full manual so you don&apos;t have to.
        </p>
        <div className="flex flex-col gap-1.5">
          {["MIG, TIG, Stick & Flux-Core", "Specs, settings & safety", "Plain language answers"].map(tip => (
            <div key={tip} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#f97316" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcessTile({ proc, onAsk, isLight, autoFlip, onHoverStart, onHoverEnd }: { proc: typeof PROCESSES[0]; onAsk: (q: string) => void; isLight: boolean; autoFlip: boolean; onHoverStart: () => void; onHoverEnd: () => void }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      style={{ perspective: "800px", height: "170px" }}
      onMouseEnter={() => { setFlipped(true); onHoverStart(); }}
      onMouseLeave={() => { setFlipped(false); onHoverEnd(); }}>
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
          transform: (flipped || autoFlip) ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>

        {/* Front */}
        <div className="process-tile-front absolute inset-0 flex flex-col overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            clipPath: chamfer(12),
            background: "var(--bg-secondary)",
            border: `1px solid var(--border)`,
            boxShadow: isLight ? "0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08)" : "none",
          }}>
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-lg font-black tracking-tight" style={{ color: proc.color }}>{proc.name}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{proc.full}</span>
            </div>
          </div>
          <div className="px-4 pb-3 flex flex-col gap-2">
            {proc.amps.map(a => (
              <div key={a.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{a.label}</span>
                  <span className="text-[10px] font-bold font-mono" style={{ color: proc.color }}>{a.val}A</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${(a.val / a.max) * 100}%`, background: `linear-gradient(90deg,${proc.color}99,${proc.color})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 overflow-hidden cursor-pointer"
          onClick={() => onAsk(proc.q)}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            clipPath: chamfer(12),
            background: `linear-gradient(135deg, ${proc.color}18 0%, ${proc.color}08 100%)`,
            border: `1px solid ${proc.color}40`,
          }}>
          <div>
            <span className="text-sm font-black" style={{ color: proc.color }}>{proc.name}</span>
            <p className="text-[11px] leading-relaxed mt-1.5" style={{ color: "var(--text-secondary)" }}>{proc.desc}</p>
          </div>
          <div className="flex flex-col gap-1 mb-1">
            {proc.facts.map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: proc.color }} />
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{f}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: proc.color }}>
            Ask the AI →
          </div>
        </div>
      </div>
    </div>
  );
}
