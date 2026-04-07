"use client";

import { useState } from "react";
import type { Artifact } from "@/types/chat";
import ArtifactFrame from "./ArtifactFrame";

const TYPE_LABEL: Record<string, string> = {
  "text/html":                    "HTML",
  "application/vnd.ant.mermaid": "Diagram",
  "image":                        "Image",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  "text/html": (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  "application/vnd.ant.mermaid": (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  "image": (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
};

interface Props {
  active:   Artifact;
  history:  Artifact[];
  onSelect: (a: Artifact) => void;
  onClose:  () => void;
}

export default function ArtifactPanel({ active, history, onSelect, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={`
        flex flex-col artifact-enter
        ${fullscreen
          ? "fixed inset-0 z-50"
          : "w-[45%] min-w-[320px] max-w-[520px] border-l"
        }
      `}
      style={{
        background:   "var(--bg-secondary)",
        borderColor:  "var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Orange accent line */}
          <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
          <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {active.title || "Artifact"}
          </span>
          <span
            className="flex-shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(249,115,22,0.1)",
              color:      "#f97316",
              border:     "1px solid rgba(249,115,22,0.2)",
            }}
          >
            {TYPE_ICON[active.type]}
            {TYPE_LABEL[active.type] || active.type}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Fullscreen */}
          <button
            onClick={() => setFullscreen(f => !f)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            title="Close panel"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs (if multiple artifacts) */}
      {history.length > 1 && (
        <div
          className="flex gap-1 px-3 py-2 overflow-x-auto flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {history.map((a) => (
            <button
              key={a.identifier}
              onClick={() => onSelect(a)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all
                ${a.identifier === active.identifier ? "font-medium" : "opacity-50 hover:opacity-75"}
              `}
              style={a.identifier === active.identifier ? {
                background: "rgba(249,115,22,0.12)",
                color:      "#f97316",
                border:     "1px solid rgba(249,115,22,0.25)",
              } : {
                background: "var(--bg-card)",
                color:      "var(--text-secondary)",
                border:     "1px solid var(--border)",
              }}
            >
              {TYPE_ICON[a.type]}
              {a.title || a.identifier}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        <ArtifactFrame artifact={active} />
      </div>
    </div>
  );
}
