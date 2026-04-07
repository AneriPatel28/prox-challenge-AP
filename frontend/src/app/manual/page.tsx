"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";


const DOCS = [
  {
    id:       "owner-manual",
    label:    "Owner's Manual",
    filename: "owner-manual.pdf",
    desc:     "Complete reference — specs, safety, setup, operation, maintenance",
    pages:    51,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    id:       "quick-start-guide",
    label:    "Quick Start Guide",
    filename: "quick-start-guide.pdf",
    desc:     "Get welding fast — setup checklist, first-pass settings, safety basics",
    pages:    8,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    id:       "selection-chart",
    label:    "Selection Chart",
    filename: "selection-chart.pdf",
    desc:     "Quick-reference tables — material, thickness, process, wire, gas",
    pages:    4,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
    ),
  },
];

function ManualContent() {
  const searchParams = useSearchParams();
  const docParam     = searchParams.get("doc");
  const pageParam    = parseInt(searchParams.get("page") || "1", 10);

  const initialDoc = DOCS.find(d => d.id === docParam) ?? DOCS[0];
  const [active, setActive]       = useState(initialDoc);
  const [page, setPage]           = useState(pageParam);
  const [collapsed, setCollapsed] = useState(false);

  // When URL params change (e.g. clicking a source link), update active doc + page
  useEffect(() => {
    if (docParam) {
      const doc = DOCS.find(d => d.id === docParam);
      if (doc) setActive(doc);
    }
    if (pageParam) setPage(pageParam);
  }, [docParam, pageParam]);

  const pdfSrc = `/files/${active.filename}#page=${page}`;

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
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-8 rounded-full" style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.8) 0%, rgba(249,115,22,0.2) 100%)" }} />
            <div>
              <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Manual Explorer
              </h1>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {active.label}{page > 1 ? ` · p.${page}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/chat?q=Explain+page+${page}+of+${encodeURIComponent(active.label)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "rgba(249,115,22,0.1)",
                border:     "1px solid rgba(249,115,22,0.25)",
                color:      "#f97316",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ask about this page
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Doc list */}
          <div
            className="w-60 flex-shrink-0 flex flex-col gap-2 p-3 overflow-y-auto"
            style={{
              borderRight: "1px solid var(--border)",
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,0.04) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          >
            <div className="flex items-center gap-2 px-2 pt-1 pb-2">
              <span className="w-1 h-1 rounded-full bg-orange-500 opacity-70" />
              <p className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>
                Documents
              </p>
            </div>
            {DOCS.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setActive(doc); setPage(1); }}
                className="text-left rounded-xl p-3 transition-all duration-150"
                style={doc.id === active.id ? {
                  background: "rgba(249,115,22,0.1)",
                  border:     "1px solid rgba(249,115,22,0.3)",
                } : {
                  background: "var(--bg-secondary)",
                  border:     "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2 mb-1.5"
                  style={{ color: doc.id === active.id ? "#f97316" : "var(--text-secondary)" }}>
                  {doc.icon}
                  <span className="text-xs font-semibold"
                    style={{ color: doc.id === active.id ? "#f97316" : "var(--text-primary)" }}>
                    {doc.label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {doc.desc}
                </p>
                <p className="text-[10px] mt-1.5 font-mono" style={{ color: "var(--text-muted)" }}>
                  {doc.pages} pages
                </p>
              </button>
            ))}

            {/* Page jump */}
            <div className="mt-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>
                Jump to page
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={active.pages}
                  value={page}
                  onChange={e => setPage(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1.5 rounded-lg text-xs text-center outline-none"
                  style={{
                    background: "var(--bg-secondary)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-primary)",
                  }}
                />
                <span className="text-xs self-center" style={{ color: "var(--text-muted)" }}>
                  / {active.pages}
                </span>
              </div>
            </div>
          </div>

          {/* PDF viewer */}
          <div className="flex-1 flex flex-col min-w-0 p-3">
            <div
              className="flex-1 rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <iframe
                key={`${active.id}-${page}`}
                src={pdfSrc}
                className="w-full h-full border-0"
                title={`${active.label} p.${page}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManualPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Loading…
      </div>
    }>
      <ManualContent />
    </Suspense>
  );
}
