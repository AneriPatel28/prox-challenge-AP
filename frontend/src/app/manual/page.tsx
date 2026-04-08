"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";

const DOCS = [
  {
    id: "owner-manual",
    filename: "owner-manual.pdf",
    title: "Owner's Manual",
    desc: "Complete reference: specs, setup, operation, maintenance, troubleshooting",
    pages: 68,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    id: "quick-start-guide",
    filename: "quick-start-guide.pdf",
    title: "Quick Start Guide",
    desc: "First-time setup: unboxing, connections, first weld in minutes",
    pages: 12,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    id: "selection-chart",
    filename: "selection-chart.pdf",
    title: "Selection Chart",
    desc: "Wire gauge, amperage, voltage, and gas reference tables",
    pages: 4,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
    ),
  },
];

export default function ManualPage() {
  const searchParams = useSearchParams();
  const [activeDoc, setActiveDoc] = useState(DOCS[0]);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // On mount, read ?doc and ?page from URL and jump directly to that page
  useEffect(() => {
    const docParam  = searchParams.get("doc");
    const pageParam = searchParams.get("page");
    if (docParam) {
      const found = DOCS.find(d => d.id === docParam);
      if (found) setActiveDoc(found);
    }
    if (pageParam) {
      const p = parseInt(pageParam, 10);
      if (!isNaN(p) && p > 0) setTargetPage(p);
    }
  }, [searchParams]);
  const isLight = mounted && resolvedTheme === "light";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "none", background: "var(--bg-secondary)", position: "relative", boxShadow: isLight ? "0 1px 8px rgba(0,0,0,0.08)" : "none" }}>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)" }} />
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-7 rounded-full"
              style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.8) 0%, rgba(249,115,22,0.2) 100%)" }} />
            <div>
              <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Manual Explorer</h1>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{activeDoc.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/chat?q=Explain+the+${encodeURIComponent(activeDoc.title)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#f97316" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ask about this manual
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Doc list sidebar */}
          <div className="w-60 flex-shrink-0 flex flex-col gap-2 p-3 overflow-y-auto"
            style={{
              borderRight: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "var(--border)"}`,
              boxShadow: isLight ? "2px 0 10px rgba(0,0,0,0.06)" : "none",
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,0.04) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}>
            <div className="flex items-center gap-2 px-2 pt-1 pb-2">
              <span className="w-1 h-1 rounded-full bg-orange-500 opacity-70" />
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Documents</p>
            </div>

            {DOCS.map(d => (
              <button key={d.id} onClick={() => { setActiveDoc(d); setTargetPage(null); }}
                className="text-left rounded-xl p-3 transition-all duration-150"
                style={d.id === activeDoc.id ? {
                  background: "rgba(249,115,22,0.1)",
                  border: "1px solid rgba(249,115,22,0.3)",
                  boxShadow: isLight ? "0 2px 8px rgba(249,115,22,0.1)" : "none",
                } : {
                  background: "var(--bg-secondary)",
                  border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "var(--border)"}`,
                  boxShadow: isLight ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                }}>
                <div className="flex items-center gap-2 mb-1"
                  style={{ color: d.id === activeDoc.id ? "#f97316" : "var(--text-secondary)" }}>
                  {d.icon}
                  <span className="text-xs font-semibold"
                    style={{ color: d.id === activeDoc.id ? "#f97316" : "var(--text-primary)" }}>
                    {d.title}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{d.desc}</p>
                <p className="text-[10px] mt-1.5 font-mono" style={{ color: "var(--text-muted)" }}>{d.pages} pages</p>
              </button>
            ))}
          </div>

          {/* PDF viewer */}
          <div className="flex-1 overflow-hidden">
            <iframe
              key={`${activeDoc.id}-${targetPage}`}
              src={`/files/${activeDoc.filename}${targetPage ? `#page=${targetPage}` : ""}`}
              className="w-full h-full"
              style={{ border: "none" }}
              title={activeDoc.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
