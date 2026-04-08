"use client";

import { useEffect, useRef, useState } from "react";

interface Props { chart: string; }

function getThemeVars() {
  const s = getComputedStyle(document.documentElement);
  const get = (v: string, fallback: string) => s.getPropertyValue(v).trim() || fallback;
  return {
    accent:   get("--accent",       "#f97316"),
    bgPrim:   get("--bg-primary",   "#0a0a0b"),
    bgSec:    get("--bg-secondary", "#111113"),
    bgCard:   get("--bg-card",      "#18181b"),
    textPri:  get("--text-primary", "#f0f0f0"),
    textMut:  get("--text-muted",   "#9ca3af"),
    border:   get("--border",       "#2a2a2e"),
  };
}

export default function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError]   = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState(0);

  // Re-render when data-theme attribute changes (light/dark toggle)
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey(k => k + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        const { accent, bgPrim, bgSec, bgCard, textPri, textMut, border } = getThemeVars();

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            // Node fills
            primaryColor:         bgCard,       // rect/rounded nodes
            secondaryColor:       bgCard,
            tertiaryColor:        bgCard,
            // Node borders — all accent so every node has orange outline
            primaryBorderColor:   accent,
            secondaryBorderColor: accent,
            tertiaryBorderColor:  accent,
            nodeBorder:           accent,
            // Text
            primaryTextColor:     textPri,
            secondaryTextColor:   textPri,
            tertiaryTextColor:    textPri,
            titleColor:           textPri,
            // Edges
            lineColor:            accent,
            edgeLabelBackground:  bgSec,
            // Background
            background:           bgPrim,
            mainBkg:              bgCard,
            clusterBkg:           bgSec,
            // Font
            fontFamily:           "'Inter', system-ui, sans-serif",
            fontSize:             "14px",
            // Note/flag nodes
            noteBorderColor:      accent,
            noteTextColor:        textMut,
            noteBkgColor:         bgSec,
          },
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height   = "auto";
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart, themeKey]);

  if (error) {
    return (
      <div className="p-3 rounded-lg text-xs font-mono"
        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
        Diagram render error: {error}
        <pre className="mt-2 whitespace-pre-wrap opacity-60">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container w-full flex items-center justify-center p-4"
      style={{ minHeight: "200px", overflowX: "auto" }}
    />
  );
}
