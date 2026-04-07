"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useChatContext } from "@/context/ChatContext";

const QUICK_TOPICS = [
  "How do I set up MIG welding?",
  "Getting porosity in my welds",
  "Arc keeps going out — why?",
  "Recommended gas for MIG?",
  "What's the duty cycle at 200A?",
];


const PROCESSES = [
  {
    id: "mig",
    name: "MIG",
    full: "Gas Metal Arc",
    minA: 30, maxA: 200, barPct: 100,
    details: [".023–.035\" solid wire", "75% Ar / 25% CO₂"],
    question: "How do I set up MIG welding?",
  },
  {
    id: "tig",
    name: "TIG",
    full: "Gas Tungsten Arc",
    minA: 15, maxA: 200, barPct: 100,
    details: ["1/16\"–1/8\" tungsten", "100% Argon"],
    question: "How do I set up TIG welding?",
  },
  {
    id: "stick",
    name: "STICK",
    full: "Shielded Metal Arc",
    minA: 20, maxA: 160, barPct: 80,
    details: ["3/32\"–1/8\" electrode", "No shielding gas"],
    question: "How do I set up stick welding?",
  },
  {
    id: "fcaw",
    name: "FCAW",
    full: "Flux-Cored",
    minA: 30, maxA: 200, barPct: 100,
    details: [".030\"–.045\" wire", "Gas or self-shielded"],
    question: "What polarity for flux-cored wire?",
  },
];

const KB_STATS = [
  ["Setup procedures",      "142"],
  ["Spec tables",           "38"],
  ["Troubleshooting cases", "89"],
  ["Weld diagrams",         "24"],
  ["Safety sections",       "31"],
];

// Chamfered corner clip-path — industrial cut look
const chamfer = (px = 14) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`;

export default function LandingPage() {
  const { sendMessage } = useChatContext();
  const router          = useRouter();

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendMessage(text);
    router.push("/chat");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg-primary)", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════════
          HERO — full-bleed command center
      ══════════════════════════════════════════ */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: "260px" }}>

        {/* Background image — Ken Burns slow zoom + drift */}
        <img src="/banner.png" alt="" className="ken-burns-img absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 40%", transformOrigin: "center center" }} />

        {/* Asymmetric overlay: heavy left, light right */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(105deg, rgba(5,5,6,0.88) 0%, rgba(5,5,6,0.75) 45%, rgba(5,5,6,0.35) 75%, rgba(5,5,6,0.15) 100%)"
        }} />

        {/* Subtle scanline texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 4px)",
          backgroundSize: "100% 4px",
        }} />

        {/* Top-right: theme toggle */}
        <div className="absolute top-4 right-5 z-10">
          <ThemeToggle />
        </div>

        {/* Content */}
        <div className="relative h-full flex items-center px-10 gap-12">

          {/* Left: text + CTAs */}
          <div className="flex flex-col gap-4 max-w-lg">

            {/* Brand tier */}
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="font-mono text-[11px] tracking-[0.25em] uppercase font-semibold" style={{ color: "#f97316" }}>
                Vulcan Series
              </span>
              <span className="font-mono text-[11px]" style={{ color: "rgba(249,115,22,0.3)" }}>·</span>
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
                Multi-process
              </span>
            </div>

            {/* Main heading — machine name is the hero */}
            <div>
              <h1 className="font-black leading-none tracking-tighter" style={{ fontSize: "clamp(2.8rem, 5vw, 4.2rem)" }}>
                <span className="text-white">OMNIPRO</span>
                <span style={{
                  background: "linear-gradient(135deg, #f97316 0%, #fbbf24 60%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginLeft: "0.25em",
                }}>220</span>
              </h1>

              {/* AI badge — secondary, sky blue to contrast the warm machine palette */}
              <div className="flex items-center gap-2 mt-3">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono tracking-[0.15em] uppercase"
                  style={{
                    background: "rgba(56,189,248,0.07)",
                    border: "1px solid rgba(56,189,248,0.22)",
                    color: "rgba(56,189,248,0.85)",
                    clipPath: chamfer(5),
                  }}
                >
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: "#38bdf8" }} />
                  AI Assistant
                </div>
              </div>

              <p className="mt-3 text-sm font-light tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                Ask anything about your machine — specs, setup, troubleshooting
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex items-center gap-3 mt-1">
              <Link
                href="/chat"
                className="group flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: "var(--accent)",
                  clipPath: chamfer(8),
                  boxShadow: "0 0 24px rgba(249,115,22,0.35)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 36px rgba(249,115,22,0.6)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(249,115,22,0.35)"; }}
              >
                Start Chatting
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>

              <Link
                href="/manual"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all duration-200"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  clipPath: chamfer(8),
                  background: "rgba(255,255,255,0.05)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.5)";
                  (e.currentTarget as HTMLElement).style.color = "#f97316";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                }}
              >
                Browse Manual
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom edge accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.6) 30%, rgba(249,115,22,0.6) 70%, transparent)" }} />
      </div>


      {/* ══════════════════════════════════════════
          BOTTOM — process showcase + questions
      ══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: Process showcase + questions ── */}
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          style={{ borderRight: "1px solid var(--border)" }}
        >

          {/* ── MIDDLE: Welding process tiles ── */}
          <div
            className="flex-1 flex flex-col justify-center px-6 py-5 overflow-hidden"
            style={{
              background: "var(--bg-primary)",
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,0.04) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          >
            {/* Section label */}
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--text-muted)" }}>
                Supported Processes
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="font-mono text-[10px]" style={{ color: "rgba(249,115,22,0.5)" }}>OmniPro 220</span>
            </div>

            {/* 4 process tiles */}
            <div className="grid grid-cols-4 gap-3">
              {PROCESSES.map((proc) => (
                <button
                  key={proc.id}
                  onClick={() => handleSend(proc.question)}
                  className="text-left flex flex-col gap-0 transition-all duration-200"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    clipPath: chamfer(10),
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "rgba(249,115,22,0.45)";
                    el.style.boxShadow = "0 0 28px rgba(249,115,22,0.1), inset 0 0 20px rgba(249,115,22,0.03)";
                    el.style.transform = "translateY(-2px)";
                    (el.querySelector(".proc-ask") as HTMLElement | null)?.style && ((el.querySelector(".proc-ask") as HTMLElement).style.opacity = "1");
                    (el.querySelector(".proc-ask") as HTMLElement | null)?.style && ((el.querySelector(".proc-ask") as HTMLElement).style.transform = "translateY(0)");
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "var(--border)";
                    el.style.boxShadow = "none";
                    el.style.transform = "translateY(0)";
                    (el.querySelector(".proc-ask") as HTMLElement | null)?.style && ((el.querySelector(".proc-ask") as HTMLElement).style.opacity = "0");
                    (el.querySelector(".proc-ask") as HTMLElement | null)?.style && ((el.querySelector(".proc-ask") as HTMLElement).style.transform = "translateY(4px)");
                  }}
                >

                  <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5">
                    {/* Process name */}
                    <div>
                      <p className="font-black tracking-tight leading-none" style={{ fontSize: "1.65rem", color: "var(--text-primary)" }}>
                        {proc.name}
                      </p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(249,115,22,0.6)" }}>
                        {proc.full}
                      </p>
                    </div>

                    {/* Amp output bar */}
                    <div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${proc.barPct}%`,
                            background: "linear-gradient(90deg, #f97316, #fbbf24)",
                            boxShadow: "0 0 6px rgba(249,115,22,0.5)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>{proc.minA}A</span>
                        <span className="font-mono text-[10px] font-semibold" style={{ color: "var(--accent)" }}>{proc.maxA}A</span>
                      </div>
                    </div>

                    {/* Key specs */}
                    <div className="flex flex-col gap-1">
                      {proc.details.map((d) => (
                        <p key={d} className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>{d}</p>
                      ))}
                    </div>

                    {/* Ask CTA — appears on hover */}
                    <div
                      className="proc-ask flex items-center gap-1 text-[10px] font-semibold"
                      style={{
                        color: "#f97316",
                        opacity: 0,
                        transform: "translateY(4px)",
                        transition: "opacity 180ms ease, transform 180ms ease",
                      }}
                    >
                      Ask about {proc.name}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── BOTTOM: Marquee strip ── */}
          <div className="flex-shrink-0 flex items-center" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}>
            {/* Inline label */}
            <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-3" style={{ borderRight: "1px solid var(--border)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Quick Questions</span>
              <span className="text-[10px]" style={{ color: "var(--border)" }}>:</span>
            </div>
            {/* Scrolling row */}
            <div className="flex-1 overflow-hidden" style={{
              maskImage: "linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%)",
            }}>
            <div className="marquee-track-reverse flex items-center py-2.5 w-max">
              {[...QUICK_TOPICS, ...QUICK_TOPICS].map((q, i) => (
                <span key={i} className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => handleSend(q)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs whitespace-nowrap rounded-lg transition-all duration-200"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "rgba(249,115,22,0.06)";
                      el.style.color = "var(--text-primary)";
                      el.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "transparent";
                      el.style.color = "var(--text-secondary)";
                      el.style.transform = "translateY(0)";
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{ color: "var(--accent)", opacity: 0.6, flexShrink: 0 }}>
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                    {q}
                  </button>
                  <span className="w-1 h-1 rounded-full mx-1 flex-shrink-0" style={{ background: "rgba(249,115,22,0.25)" }} />
                </span>
              ))}
            </div>
            </div>
          </div>
        </div>


        {/* ── RIGHT: Instrument panel ── */}
        <div
          className="w-64 flex-shrink-0 flex flex-col"
          style={{ background: "var(--bg-secondary)" }}
        >
          {/* Panel header */}
          <div
            className="px-5 py-3 flex-shrink-0 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase" style={{ color: "var(--text-muted)" }}>
              Knowledge Base
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-[9px]" style={{ color: "#4ade80" }}>INDEXED</span>
            </span>
          </div>

          {/* Stat readouts */}
          <div className="flex-1 flex flex-col justify-center px-5 py-4 gap-1">
            {KB_STATS.map(([label, count]) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span
                  className="font-mono text-sm font-semibold tabular-nums"
                  style={{ color: "var(--accent)" }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>

          {/* Full report link */}
          <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <Link
              href="/eval"
              className="flex items-center justify-between w-full px-4 py-2.5 font-mono text-xs transition-all duration-150"
              style={{
                clipPath: chamfer(6),
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.4)";
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(249,115,22,0.1)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <span>VIEW EVAL REPORT</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
