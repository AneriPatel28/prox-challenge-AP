"use client";

import { useEffect, useRef } from "react";
import type { ThinkingStep } from "@/types/chat";

interface Props { steps: ThinkingStep[]; }

const STEP_ICONS: Record<string, string> = {
  "Analyzing":   "🔍",
  "Searching":   "📖",
  "Found":       "✓",
  "Loading":     "🖼",
  "Recalling":   "💭",
  "Synthesizing":"⚡",
  "Preparing":   "✨",
  "default":     "◦",
};

function getIcon(msg: string): string {
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (msg.startsWith(key)) return icon;
  }
  return STEP_ICONS.default;
}

export default function ThinkingIndicator({ steps }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = steps[steps.length - 1];

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [steps.length]);

  return (
    <div ref={containerRef} className="px-4 pb-2 max-w-3xl mx-auto w-full">
      <div
        className="rounded-xl px-4 py-3"
        style={{
          background: "var(--bg-card)",
          border:     "1px solid var(--border)",
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Arc pulse dot */}
          <div className="relative flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <div
              className="absolute w-4 h-4 rounded-full animate-arc-pulse opacity-40"
              style={{ background: "var(--accent)" }}
            />
          </div>
          <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            Thinking
          </span>
          {/* Animated dots */}
          <div className="flex gap-0.5 ml-0.5">
            <span className="w-1 h-1 rounded-full dot-1" style={{ background: "var(--accent)", display: "inline-block" }} />
            <span className="w-1 h-1 rounded-full dot-2" style={{ background: "var(--accent)", display: "inline-block" }} />
            <span className="w-1 h-1 rounded-full dot-3" style={{ background: "var(--accent)", display: "inline-block" }} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 rounded-full mb-3 overflow-hidden"
          style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full animate-thinking-bar"
            style={{ background: `linear-gradient(90deg, var(--accent), #fb923c)` }}
          />
        </div>

        {/* Steps list — show last 3 */}
        <div className="space-y-1">
          {steps.slice(-3).map((step, i, arr) => {
            const isLatest = i === arr.length - 1;
            return (
              <div
                key={`${step.ts}-${i}`}
                className="flex items-center gap-2 text-xs animate-fade-up"
                style={{
                  color:   isLatest ? "var(--text-primary)" : "var(--text-muted)",
                  opacity: isLatest ? 1 : 0.55,
                }}
              >
                <span className="w-4 text-center flex-shrink-0">{getIcon(step.message)}</span>
                <span>{step.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
