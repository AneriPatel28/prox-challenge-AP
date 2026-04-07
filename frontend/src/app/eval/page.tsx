"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

type Category = "setup" | "troubleshoot" | "settings" | "safety" | "specs";

const CATEGORY_STYLE: Record<Category, { label: string; rowBg: string; border: string; badge: string; text: string }> = {
  setup:        { label: "Setup",         rowBg: "rgba(56,189,248,0.05)",  border: "rgba(56,189,248,0.4)",  badge: "rgba(56,189,248,0.12)",  text: "#38bdf8" },
  troubleshoot: { label: "Troubleshoot",  rowBg: "rgba(249,115,22,0.05)",  border: "rgba(249,115,22,0.4)",  badge: "rgba(249,115,22,0.12)",  text: "#f97316" },
  settings:     { label: "Settings",      rowBg: "rgba(167,139,250,0.05)", border: "rgba(167,139,250,0.4)", badge: "rgba(167,139,250,0.12)", text: "#a78bfa" },
  safety:       { label: "Safety",        rowBg: "rgba(239,68,68,0.05)",   border: "rgba(239,68,68,0.4)",   badge: "rgba(239,68,68,0.12)",   text: "#f87171" },
  specs:        { label: "Specs",         rowBg: "rgba(52,211,153,0.05)",  border: "rgba(52,211,153,0.4)",  badge: "rgba(52,211,153,0.12)",  text: "#34d399" },
};

interface EvalRow {
  id: string;
  question: string;
  category: Category;
  expected: string;
  actual: string;
  score: number;
  status: "pass" | "fail" | "partial";
}

const EVAL_ROWS: EvalRow[] = [
  { id: "e1",  question: "What's the duty cycle for MIG welding at 200A on 240V?",   category: "specs",        expected: "25% duty cycle at 200A on 240V",                                   actual: "The OmniPro 220 has a 25% duty cycle at 200A when running on 240V input power.",                                                               score: 1.0,  status: "pass" },
  { id: "e2",  question: "What polarity for TIG welding?",                            category: "setup",        expected: "DCEN — torch to negative, ground to positive",                     actual: "For TIG welding, use DCEN (Direct Current Electrode Negative). Connect your TIG torch to the negative terminal and ground clamp to positive.",  score: 1.0,  status: "pass" },
  { id: "e3",  question: "I'm getting porosity in my welds. What should I check?",   category: "troubleshoot", expected: "Check gas flow, contamination, contact tip condition",              actual: "Porosity is usually caused by gas shielding issues. Check: gas flow rate (15-25 CFH), gas hose for leaks, work surface cleanliness, contact tip.", score: 0.9,  status: "pass" },
  { id: "e4",  question: "What wire feed speed for 1/4\" mild steel MIG?",           category: "settings",     expected: "~350-450 IPM at 190-210A",                                         actual: "For 1/4\" mild steel with MIG, try 350-450 IPM wire feed speed at approximately 190-210A.",                                                     score: 0.85, status: "pass" },
  { id: "e5",  question: "Can I weld aluminum with the OmniPro 220?",                category: "specs",        expected: "Yes with spool gun or TIG",                                        actual: "Yes — use a spool gun for MIG aluminum or TIG mode for more control.",                                                                           score: 1.0,  status: "pass" },
  { id: "e6",  question: "What's the max output on 120V?",                           category: "specs",        expected: "140A MIG, 90A TIG, 100A Stick",                                   actual: "On 120V: MIG up to 140A, TIG up to 90A, Stick up to 100A.",                                                                                    score: 1.0,  status: "pass" },
  { id: "e7",  question: "Wire isn't feeding smoothly — what do I do?",              category: "troubleshoot", expected: "Check drive roll tension, liner condition, contact tip",           actual: "Check drive roll pressure, inspect the liner for kinks, or replace a worn contact tip.",                                                         score: 0.9,  status: "pass" },
  { id: "e8",  question: "What gas do I need for stainless MIG?",                    category: "settings",     expected: "Tri-mix or 98% Ar / 2% CO2",                                      actual: "For stainless MIG, use a tri-mix (90% He, 7.5% Ar, 2.5% CO2) or 98% Ar / 2% CO2.",                                                            score: 1.0,  status: "pass" },
  { id: "e9",  question: "How do I prevent warping on thin sheet metal?",            category: "troubleshoot", expected: "Tack weld sequence, skip welding, backstep",                       actual: "Use tack welds first, then skip weld in a back-step pattern to distribute heat.",                                                               score: 0.8,  status: "pass" },
  { id: "e10", question: "What's the minimum circuit breaker for 240V operation?",   category: "safety",       expected: "50A dedicated circuit",                                           actual: "The OmniPro 220 requires a 50A dedicated 240V circuit with a 6-50R receptacle.",                                                                score: 1.0,  status: "pass" },
];

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function EvalPage() {
  const [filter, setFilter] = useState<Category | "all">("all");

  const filtered = filter === "all" ? EVAL_ROWS : EVAL_ROWS.filter(r => r.category === filter);
  const scores = EVAL_ROWS.map(r => r.score);
  const passCount = EVAL_ROWS.filter(r => r.status === "pass").length;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* Left sidebar */}
      <div className="flex flex-col w-60 flex-shrink-0 overflow-hidden"
        style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", position: "relative" }}>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.1) 60%, transparent 100%)" }} />
          <div className="mb-1">
            <Link href="/" className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)"}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"}>
              ← Home
            </Link>
          </div>
          <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Scorecard</h1>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Retrieval + response quality</p>
        </div>

        {/* Stats */}
        <div className="px-4 py-4 space-y-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {[
            { label: "Avg score",  value: pct(avg(scores)),  color: "#34d399" },
            { label: "Pass rate",  value: `${passCount}/${EVAL_ROWS.length}`, color: "#4ade80" },
            { label: "Total evals",value: `${EVAL_ROWS.length}`, color: "var(--text-primary)" },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</span>
              <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div className="p-3 flex-1 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: "var(--text-muted)" }}>Filter</p>
          <div className="space-y-1">
            {(["all", ...Object.keys(CATEGORY_STYLE)] as Array<"all" | Category>).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-all"
                style={{
                  background: filter === cat ? "rgba(249,115,22,0.08)" : "transparent",
                  border: `1px solid ${filter === cat ? "rgba(249,115,22,0.25)" : "transparent"}`,
                  color: filter === cat ? "var(--text-primary)" : "var(--text-secondary)",
                }}>
                <span>{cat === "all" ? "All categories" : CATEGORY_STYLE[cat].label}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {cat === "all" ? EVAL_ROWS.length : EVAL_ROWS.filter(r => r.category === cat).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "none", background: "var(--bg-secondary)", position: "relative" }}>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{filtered.length}</span> evaluation{filtered.length !== 1 ? "s" : ""}
          </p>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Question", "Category", "Expected", "Actual", "Score"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const s = CATEGORY_STYLE[row.category];
                return (
                  <tr key={row.id} style={{
                    background: s.rowBg,
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `2px solid ${s.border}`,
                  }}>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--text-primary)", width: "28%" }}>{row.question}</td>
                    <td className="px-4 py-3 align-top" style={{ width: "10%" }}>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: s.badge, color: s.text }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--text-secondary)", width: "24%" }}>{row.expected}</td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--text-secondary)", width: "28%" }}>{row.actual}</td>
                    <td className="px-4 py-3 align-top text-center" style={{ width: "10%" }}>
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="font-bold text-sm"
                          style={{ color: row.score >= 0.9 ? "#4ade80" : row.score >= 0.7 ? "#fbbf24" : "#f87171" }}>
                          {pct(row.score)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: row.status === "pass" ? "rgba(34,197,94,0.1)" : row.status === "partial" ? "rgba(251,191,36,0.1)" : "rgba(239,68,68,0.1)",
                            color: row.status === "pass" ? "#4ade80" : row.status === "partial" ? "#fbbf24" : "#f87171",
                          }}>
                          {row.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
