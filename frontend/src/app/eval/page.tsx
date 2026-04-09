"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Category = "specs" | "polarity" | "settings" | "troubleshooting" | "visual" | "cross_reference" | "ambiguous" | "tone" | "safety" | "robustness";

const CAT_STYLE: Record<string, { label: string; colorDark: string; colorLight: string; bg: string; border: string }> = {
  specs:          { label: "Specs",          colorDark: "#34d399", colorLight: "#047857", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.35)"  },
  polarity:       { label: "Polarity",       colorDark: "#38bdf8", colorLight: "#0369a1", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.35)"  },
  settings:       { label: "Settings",       colorDark: "#a78bfa", colorLight: "#6d28d9", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.35)" },
  troubleshooting:{ label: "Troubleshoot",   colorDark: "#f97316", colorLight: "#c2410c", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.35)"  },
  visual:         { label: "Visual",         colorDark: "#fb923c", colorLight: "#c2410c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.35)"  },
  cross_reference:{ label: "Cross-Ref",      colorDark: "#60a5fa", colorLight: "#1d4ed8", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.35)"  },
  ambiguous:      { label: "Ambiguous",      colorDark: "#fbbf24", colorLight: "#b45309", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.35)"  },
  tone:           { label: "Tone",           colorDark: "#c084fc", colorLight: "#7c3aed", bg: "rgba(192,132,252,0.1)", border: "rgba(192,132,252,0.35)" },
  safety:         { label: "Safety",         colorDark: "#f87171", colorLight: "#dc2626", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.35)" },
  robustness:     { label: "Robustness",     colorDark: "#94a3b8", colorLight: "#475569", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.35)" },
  rejection:      { label: "Rejection",      colorDark: "#e879f9", colorLight: "#86198f", bg: "rgba(232,121,249,0.1)", border: "rgba(232,121,249,0.35)" },
  prompt_injection:{ label: "Prompt Inject", colorDark: "#f43f5e", colorLight: "#be123c", bg: "rgba(244,63,94,0.1)",   border: "rgba(244,63,94,0.35)"   },
};

interface DimScores {
  factual_accuracy: number;
  completeness: number;
  relevance: number;
  conciseness: number;
  tone: number;
  safety_awareness: number;
  artifact_quality?: number;
  source_citation: number;
}

interface EvalResult {
  tc_id: string;
  question: string;
  category: string;
  response: string;
  score: number;
  passed: boolean;
  feedback: string;
  dimension_scores: DimScores;
  has_artifact: boolean;
  artifact_types: string[];
  sources_found: string[];
  must_not_violated: boolean;
  // ground truth
  sources_expected: string[];
  must_mention: string[];
  must_not_claim: string[];
  key_facts: string[];
}

interface Summary {
  avg_score: number;
  pass_rate: number;
  pass_count: number;
  total: number;
  by_category: Record<string, { avg: number; count: number; passed: number }>;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const scoreColor = (s: number) => s >= 0.85 ? "#4ade80" : s >= 0.70 ? "#fbbf24" : "#f87171";
const sc = (s: number, light = false) =>
  s >= 0.85 ? (light ? "#15803d" : "#4ade80")
  : s >= 0.70 ? (light ? "#b45309" : "#fbbf24")
  : (light ? "#dc2626" : "#f87171");
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec.toString().padStart(2,"0")}s` : `${sec}s`;
};

const DIM_TOOLTIPS: Record<string, string> = {
  "factual_accuracy": "Did the agent state anything wrong? Checks for incorrect values (amps, duty cycle, voltage) and false claims about the OmniPro 220. Omissions don't count here — only wrong statements.",
  "completeness":     "Did the response cover everything a garage beginner needs? Evaluated holistically across text + artifact together. Key facts and must-mention items are hints, not a strict checklist.",
  "relevance":        "Does the response answer THIS specific question? Penalises generic welding advice that could apply to any question, and responses that drift into unrelated topics the user didn't ask about.",
  "source_citation":  "Did the agent retrieve from the right manual pages? Checks whether retrieved pages match the expected source pages (owner-manual, quick-start-guide, selection-chart).",
  "artifact_quality": "Quality of the generated diagram, calculator, or flowchart. Mermaid wiring diagrams, interactive HTML calculators, and troubleshooting flowcharts are all evaluated on correctness and usefulness.",
  "conciseness":      "Is the length appropriate for the question? Penalises padding, repeated info, restating the question, or describing in text what the artifact already shows interactively.",
  "tone":             "Does it sound like a knowledgeable friend, not a technical manual? Should be conversational, plain words, short sentences — never robotic or corporate. Target: garage beginner, not a pro welder.",
  "safety_awareness": "Are safety warnings present where the situation demands them? Electrical hazards, PPE, fire risk. Score 1.0 if the question has no safety dimension — no penalty for not adding unnecessary warnings.",
};

function DimBar({ label, value, dimKey, isLight = false }: { label: string; value: number; dimKey?: string; isLight?: boolean }) {
  const tooltip = dimKey ? DIM_TOOLTIPS[dimKey] : undefined;
  return (
    <div className="flex items-center gap-2 group relative">
      <span className="text-[10px] w-40 flex-shrink-0 cursor-default" style={{ color: "var(--text-muted)" }}>{label}</span>
      {tooltip && (
        <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 rounded-lg px-2.5 py-2 text-[10px] leading-relaxed shadow-lg pointer-events-none"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          {tooltip}
        </div>
      )}
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: pct(value), background: sc(value, isLight) }} />
      </div>
      <span className="text-[10px] w-7 text-right font-mono" style={{ color: sc(value, isLight) }}>{pct(value)}</span>
    </div>
  );
}

function DimBarNA({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 opacity-40 group relative">
      <span className="text-[10px] w-40 flex-shrink-0 cursor-default" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 rounded-lg px-2.5 py-2 text-[10px] leading-relaxed shadow-lg pointer-events-none"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        No artifact was generated for this response — dimension excluded from score and weight redistributed across other dimensions.
      </div>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: "0%", background: "var(--border)" }} />
      </div>
      <span className="text-[10px] w-7 text-right font-mono" style={{ color: "var(--text-muted)" }}>N/A</span>
    </div>
  );
}

export default function EvalPage() {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const check = () => setIsLight(!document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Theme-aware helpers
  const chipBg   = (rgba: string) => isLight ? rgba.replace(/[\d.]+\)$/, "0.18)") : rgba;

  const [running, setRunning]     = useState(false);
  const [results, setResults]     = useState<EvalResult[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [progress, setProgress]   = useState<{ current: number; total: number; tc_id: string; question: string } | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<string>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [lastRunAt, setLastRunAt]   = useState<string | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [totalCases, setTotalCases] = useState<number | null>(null);
  const [elapsed, setElapsed]       = useState(0);   // seconds since run started
  const [retrying, setRetrying]     = useState<{ label: string; attempt: number; wait: number } | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);

  // Tick every second while running
  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  // Load case count + saved results on mount
  useEffect(() => {
    // Always fetch count first — shows correct number even before any run
    fetch(`${API_URL}/api/eval/count`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.total) setTotalCases(data.total); })
      .catch(() => {});

    // Then try to load saved results if a run has been done
    fetch(`${API_URL}/api/eval/results`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        setResults(data.results ?? []);
        setSummary(data.summary ? { ...data.summary, type: "summary" } : null);
        setLastRunAt(data.run_at ?? null);
        if (data.summary?.total) setTotalCases(data.summary.total);
      })
      .catch(status => {
        if (status !== 404) setLoadError("Could not load saved results");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runEvalWith = useCallback(async (caseIds: string[], merge: boolean) => {
    setRunning(true);
    if (!merge) { setResults([]); setSummary(null); }
    setProgress(null);
    setLoadError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const resp = await fetch(`${API_URL}/api/eval/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abort.signal,
        body:    JSON.stringify({ case_ids: caseIds, merge }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(raw); } catch { continue; }

          if (ev.type === "heartbeat") continue;
          if (ev.type === "progress") { const p = ev as unknown as typeof progress; setProgress(p); if (p?.total) setTotalCases(p.total); setRetrying(null); }
          if (ev.type === "retry")    setRetrying(ev as unknown as typeof retrying);
          if (ev.type === "result") {
            const r = ev as unknown as EvalResult;
            if (merge) {
              // replace the existing entry for this tc_id, or append if new
              setResults(prev => {
                const idx = prev.findIndex(x => x.tc_id === r.tc_id);
                if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
                return [...prev, r];
              });
            } else {
              setResults(prev => [...prev, r]);
            }
          }
          if (ev.type === "summary") { setSummary(ev as unknown as Summary); setLastRunAt(new Date().toISOString()); }
          if (ev.type === "done")     break;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Eval failed:", err);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, []);

  const runEval         = useCallback(() => runEvalWith([], false), [runEvalWith]);
  const rerunFailed     = useCallback(() => {
    const failedIds = results.filter(r => !r.passed).map(r => r.tc_id);
    if (failedIds.length === 0) return;
    runEvalWith(failedIds, true);
  }, [results, runEvalWith]);

  const stopEval = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const filtered = filter === "all" ? results : results.filter(r => r.category === filter);
  const categories = [...new Set(results.map(r => r.category))];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "none", background: "var(--bg-secondary)", position: "relative", boxShadow: "none" }}>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)" }} />
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-7 rounded-full"
              style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.8) 0%, rgba(249,115,22,0.2) 100%)" }} />
            <div>
              <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Scorecard</h1>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {running
                  ? `Running… ${progress?.current ?? 0} / ${progress?.total ?? totalCases ?? "…"}`
                  : summary
                    ? `${summary.total} cases · avg ${pct(summary.avg_score)} · ${summary.pass_count} passed${lastRunAt ? ` · ${new Date(lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}`
                    : `${totalCases != null ? totalCases : "…"} test cases · LLM-as-judge scoring · results saved automatically`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Left stats panel */}
          <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
            style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>

            {/* Progress bar */}
            {running && (
              <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                {/* Progress header with live timer */}
                <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  <span>Progress</span>
                  <span>{progress?.current ?? 0} / {progress?.total ?? totalCases ?? "…"}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${((progress?.current ?? 0) / (progress?.total ?? totalCases ?? 1)) * 100}%`, background: "var(--accent)" }} />
                </div>
                {retrying ? (
                  <p className="text-[9px] mt-1.5 font-medium" style={{ color: "#fbbf24" }}>
                    ⚠ API overloaded — retrying {retrying.label} (attempt {retrying.attempt}, waiting {retrying.wait}s)
                  </p>
                ) : progress?.question && (
                  <p className="text-[9px] mt-1.5 truncate" style={{ color: "var(--text-muted)" }}>{progress.question}</p>
                )}

                {/* Elapsed + estimated remaining */}
                <div className="mt-2.5 rounded-lg px-2.5 py-2 flex items-center justify-between"
                  style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                  <div className="text-center flex-1">
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Elapsed</p>
                    <p className="text-xs font-bold font-mono mt-0.5" style={{ color: "#f97316" }}>{fmtTime(elapsed)}</p>
                  </div>
                  <div className="w-px h-6 mx-2" style={{ background: "rgba(249,115,22,0.2)" }} />
                  <div className="text-center flex-1">
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Est. remaining</p>
                    <p className="text-xs font-bold font-mono mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {(() => {
                        const done  = progress?.current ?? 0;
                        const total = progress?.total ?? totalCases ?? 0;
                        if (done === 0 || total === 0) return "…";
                        const perCase = elapsed / done;
                        const remaining = Math.round(perCase * (total - done));
                        return fmtTime(remaining);
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary stats */}
            {summary && (
              <div className="px-4 py-3 flex-shrink-0 space-y-2" style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  { label: "Avg score",  value: pct(summary.avg_score),  color: sc(summary.avg_score, isLight)  },
                  { label: "Pass rate",  value: pct(summary.pass_rate),   color: sc(summary.pass_rate, isLight)  },
                  { label: "Passed",     value: `${summary.pass_count}/${summary.total}`, color: "var(--text-primary)" },
                  { label: "Run time",   value: elapsed > 0 ? fmtTime(elapsed) : "—", color: "var(--text-muted)" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                    <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Category filter */}
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-widest font-mono mb-2 px-1" style={{ color: "var(--text-muted)" }}>Filter</p>
              <div className="space-y-1">
                <button onClick={() => setFilter("all")}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left"
                  style={{
                    background: filter === "all" ? "rgba(249,115,22,0.08)" : "transparent",
                    border: `1px solid ${filter === "all" ? "rgba(249,115,22,0.25)" : "transparent"}`,
                    color: filter === "all" ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                  <span>All</span>
                  <span style={{ color: "var(--text-muted)" }} className="text-[10px]">{results.length}</span>
                </button>
                {categories.map(cat => {
                  const s = CAT_STYLE[cat] ?? { label: cat, colorDark: "#94a3b8", colorLight: "#475569", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.35)" };
                  const catColor = isLight ? s.colorLight : s.colorDark;
                  const count = results.filter(r => r.category === cat).length;
                  const catSummary = summary?.by_category[cat];
                  return (
                    <button key={cat} onClick={() => setFilter(cat)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left"
                      style={{
                        background: filter === cat ? chipBg(s.bg) : "transparent",
                        border: `1px solid ${filter === cat ? s.border : "transparent"}`,
                        color: filter === cat ? "var(--text-primary)" : "var(--text-secondary)",
                      }}>
                      <span>{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        {catSummary && (
                          <span className="text-[10px] font-mono" style={{ color: sc(catSummary.avg, isLight) }}>
                            {pct(catSummary.avg)}
                          </span>
                        )}
                        <span style={{ color: "var(--text-muted)" }} className="text-[10px]">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto">
            {loadError && (
              <div className="mx-4 mt-4 px-4 py-2.5 rounded-lg text-xs"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                {loadError}
              </div>
            )}

            {results.length === 0 && !running && (
              <div className="flex flex-col items-center justify-center h-full gap-4"
                style={{ color: "var(--text-muted)" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Ready to evaluate</p>
                  <p className="text-xs mt-1">Run <code className="text-[10px] px-1 py-0.5 rounded" style={{background:"var(--bg-secondary)"}}>python scripts/run_eval.py</code> to generate results</p>
                </div>
              </div>
            )}

            {filtered.map(r => {
              const s = CAT_STYLE[r.category] ?? { label: r.category, colorDark: "#94a3b8", colorLight: "#475569", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" };
              const catColor = isLight ? s.colorLight : s.colorDark;
              const isOpen = expanded === r.tc_id;
              return (
                <div key={r.tc_id}
                  className="border-b transition-all"
                  style={{ borderColor: "var(--border)", borderLeft: `2px solid ${r.passed ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}` }}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : r.tc_id)}
                    style={{ background: isOpen ? "rgba(249,115,22,0.03)" : "transparent" }}>
                    {/* Score circle */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ background: r.passed ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: sc(r.score, isLight), border: `1.5px solid ${sc(r.score, isLight)}` }}>
                      {pct(r.score)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{r.tc_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: chipBg(s.bg), color: catColor }}>
                          {s.label}
                        </span>
                        {r.has_artifact && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: chipBg("rgba(249,115,22,0.1)"), color: "#f97316" }}>
                            ⬡ {r.artifact_types[0] ?? "artifact"}
                          </span>
                        )}
                        {r.must_not_violated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: chipBg("rgba(239,68,68,0.1)"), color: isLight ? "#dc2626" : "#f87171" }}>
                            ⚠ must_not violated
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{r.question}</p>
                    </div>

                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="flex-shrink-0 transition-transform"
                      style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 pt-3 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>

                      {/* Two-column: response | ground truth */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Actual response */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
                            Actual Response
                          </p>
                          <div className="rounded-lg p-3 text-xs leading-relaxed"
                            style={{ background: isLight ? "var(--bg-card)" : "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                            {r.response || <span style={{ color: "var(--text-muted)" }}>[no response]</span>}
                          </div>
                          {/* Artifacts generated */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Artifacts:</span>
                            {r.has_artifact
                              ? r.artifact_types.map((t, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>{t}</span>
                                ))
                              : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>none generated</span>
                            }
                          </div>
                          {/* Sources retrieved */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Retrieved pages:</span>
                            {r.sources_found.length > 0
                              ? r.sources_found.map((p, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: chipBg("rgba(96,165,250,0.1)"), color: isLight ? "#1d4ed8" : "#60a5fa" }}>p{p}</span>
                                ))
                              : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>none</span>
                            }
                          </div>
                        </div>

                        {/* Ground truth */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
                            Ground Truth
                          </p>
                          <div className="rounded-lg p-3 space-y-2.5"
                            style={{ background: isLight ? "var(--bg-card)" : "var(--bg-primary)", border: "1px solid var(--border)" }}>
                            {/* Key facts */}
                            {r.key_facts?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Key facts required</p>
                                <ul className="space-y-0.5">
                                  {r.key_facts.map((f, i) => (
                                    <li key={i} className="text-[11px] flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                                      <span style={{ color: "#4ade80" }}>✓</span>{f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Must mention */}
                            {r.must_mention?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Must mention</p>
                                <div className="flex flex-wrap gap-1">
                                  {r.must_mention.map((m, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                      style={{ background: chipBg("rgba(74,222,128,0.1)"), color: isLight ? "#15803d" : "#4ade80" }}>{m}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Must NOT claim */}
                            {r.must_not_claim?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Must NOT claim</p>
                                <div className="flex flex-wrap gap-1">
                                  {r.must_not_claim.map((m, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                      style={{ background: chipBg(r.must_not_violated ? "rgba(248,113,113,0.15)" : "rgba(248,113,113,0.08)"), color: isLight ? "#dc2626" : "#f87171" }}>{m}</span>
                                  ))}
                                </div>
                                {r.must_not_violated && (
                                  <p className="text-[10px] mt-1 font-semibold" style={{ color: "#f87171" }}>⚠ Violation detected — factual accuracy penalised −0.3</p>
                                )}
                              </div>
                            )}
                            {/* Expected sources */}
                            {r.sources_expected?.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Expected pages:</span>
                                {r.sources_expected.map((s, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: chipBg("rgba(96,165,250,0.1)"), color: isLight ? "#1d4ed8" : "#60a5fa" }}>{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Judge feedback */}
                      {r.feedback && (
                        <div className="rounded-lg px-3 py-2.5 text-xs italic"
                          style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)", color: "var(--text-muted)" }}>
                          <span className="font-semibold not-italic" style={{ color: "#f97316" }}>Judge: </span>{r.feedback}
                        </div>
                      )}

                      {/* All dimension score bars — weights redistribute when no artifact */}
                      {(() => {
                        const hasArt = r.dimension_scores.artifact_quality !== undefined;
                        const scale  = hasArt ? 1 : (0.85 / 0.75);
                        const w = (base: number) => `${Math.round(base * scale * 100) / 100}`;
                        return (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Dimension Scores</p>
                            <DimBar label={`Factual accuracy (${w(0.25)})`} value={r.dimension_scores.factual_accuracy} dimKey="factual_accuracy" isLight={isLight} />
                            <DimBar label={`Completeness (${w(0.20)})`}     value={r.dimension_scores.completeness}     dimKey="completeness"     isLight={isLight} />
                            <DimBar label={`Relevance (${w(0.15)})`}        value={r.dimension_scores.relevance}        dimKey="relevance"        isLight={isLight} />
                            <DimBar label="Source citation (0.15)"          value={r.dimension_scores.source_citation ?? 1} dimKey="source_citation" isLight={isLight} />
                            {hasArt
                              ? <DimBar label="Artifact quality (0.10)"     value={r.dimension_scores.artifact_quality!} dimKey="artifact_quality" isLight={isLight} />
                              : <DimBarNA label="Artifact quality (excluded — none generated)" />
                            }
                            <DimBar label={`Conciseness (${w(0.05)})`}      value={r.dimension_scores.conciseness ?? 0.5} dimKey="conciseness"  isLight={isLight} />
                            <DimBar label={`Tone (${w(0.05)})`}             value={r.dimension_scores.tone}               dimKey="tone"         isLight={isLight} />
                            <DimBar label={`Safety awareness (${w(0.05)})`} value={r.dimension_scores.safety_awareness}   dimKey="safety_awareness" isLight={isLight} />
                          </div>
                        );
                      })()}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div id="end" />
    </div>
  );
}
