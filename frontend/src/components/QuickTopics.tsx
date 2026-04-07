"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

// Chamfered corner clip-path
const chamfer = (px = 10) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`;

const SCENARIOS = [
  {
    id: "setup",
    title: "Just setting it up",
    desc: "First time with the machine",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      </svg>
    ),
    questions: [
      "How do I set up MIG welding?",
      "What polarity do I need for flux-cored wire?",
      "TIG torch connection guide",
      "How do I load wire into the drive rolls?",
    ],
  },
  {
    id: "troubleshoot",
    title: "Something's not right",
    desc: "Welds looking bad or arc won't cooperate",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    questions: [
      "Getting porosity in my welds",
      "Arc keeps going out — why?",
      "Too much spatter, how do I fix it?",
      "Wire isn't feeding smoothly",
    ],
  },
  {
    id: "settings",
    title: "What settings to use",
    desc: "Voltage, wire speed, gas — for your material",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
        <circle cx="2" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>
      </svg>
    ),
    questions: [
      "Wire feed speed for 1/4\" mild steel?",
      "Recommended gas for MIG welding?",
      "What's the duty cycle at 200A?",
      "Max output for TIG on 120V?",
    ],
  },
];

interface Props {
  onSelect: (question: string) => void;
}

export default function QuickTopics({ onSelect }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 max-w-3xl mx-auto">

      {/* Arc + heading */}
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center w-14 h-14 mb-4">
          <div
            className="absolute inset-0 rounded-full animate-arc-pulse"
            style={{ background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute inset-0 rounded-full animate-arc-pulse"
            style={{ background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)", animationDelay: "0.6s" }}
          />
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <rect x="3" y="18" width="12" height="5" rx="2" style={{ fill: "var(--text-secondary)" }} opacity="0.6" />
            <rect x="13" y="19.5" width="5" height="3" rx="1" style={{ fill: "var(--text-muted)" }} opacity="0.4" />
            <line x1="18" y1="21" x2="27" y2="12" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="27" cy="12" r="3" fill="#fb923c"/>
            <circle cx="27" cy="12" r="5" fill="#f97316" opacity="0.2" className="animate-arc-pulse"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold mb-1.5 tracking-tight" style={{ color: "var(--text-primary)" }}>
          What do you need help with?
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Select a topic or type your own question below
        </p>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        {SCENARIOS.map((scenario) => (
          <div
            key={scenario.id}
            className="flex flex-col"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              clipPath: chamfer(10),
              boxShadow: isLight ? "0 6px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {/* Card header */}
            <div
              className="flex items-center gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ color: "var(--accent)" }}>{scenario.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {scenario.title}
                </p>
                <p className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  {scenario.desc}
                </p>
              </div>
            </div>

            {/* Questions */}
            <div className="flex flex-col px-2 py-2 gap-1">
              {scenario.questions.map((q) => (
                <button
                  key={q}
                  onClick={() => onSelect(q)}
                  className="flex items-start gap-2 px-3 py-2.5 text-left rounded-lg transition-all duration-150"
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)", opacity: 0.6 }}>
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                  <span className="text-xs leading-relaxed">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
        Or just type your question below — the assistant knows the full owner's manual
      </p>
    </div>
  );
}
