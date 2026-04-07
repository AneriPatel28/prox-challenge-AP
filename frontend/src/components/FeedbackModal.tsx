"use client";

import { useState } from "react";

interface Props { open: boolean; onClose: () => void; }

const RATINGS = [
  { value: 5, label: "Excellent", color: "#4ade80" },
  { value: 4, label: "Good",      color: "#a3e635" },
  { value: 3, label: "Okay",      color: "#fbbf24" },
  { value: 2, label: "Poor",      color: "#fb923c" },
  { value: 1, label: "Bad",       color: "#f87171" },
];

export default function FeedbackModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"form" | "done">("form");
  const [rating, setRating] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = async () => {
    if (!form.name || !form.email || !rating) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, message: form.message, rating }),
      });
    } catch { /* non-fatal — still show thank you */ }
    setStep("done");
  };

  const reset = () => { setStep("form"); setRating(null); setForm({ name: "", email: "", message: "" }); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) { onClose(); reset(); } }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-up"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", position: "relative" }}>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.5) 0%, transparent 100%)" }} />
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Share Feedback</span>
          </div>
          <button onClick={() => { onClose(); reset(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {step === "done" ? (
          /* ── Thank you ── */
          <div className="flex flex-col items-center justify-center px-6 py-12 gap-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Thanks, {form.name.split(" ")[0]}!</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Your feedback helps us improve the assistant.</p>
            </div>
            <button onClick={() => { onClose(); reset(); }}
              className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#f97316" }}>
              Close
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="p-5 flex flex-col gap-4">

            {/* Rating */}
            <div>
              <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--text-secondary)" }}>How would you rate your experience?</p>
              <div className="flex gap-2">
                {RATINGS.map(r => (
                  <button key={r.value} onClick={() => setRating(r.value)}
                    className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-semibold transition-all"
                    style={{
                      background: rating === r.value ? `${r.color}18` : "var(--bg-card)",
                      border: `1px solid ${rating === r.value ? r.color + "60" : "var(--border)"}`,
                      color: rating === r.value ? r.color : "var(--text-muted)",
                    }}>
                    <span className="text-lg leading-none">{"★".repeat(r.value)}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            {[
              { key: "name",    label: "Your Name",     placeholder: "John Doe",          type: "text" },
              { key: "email",   label: "Email Address", placeholder: "you@example.com",   type: "email" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(249,115,22,0.5)"}
                  onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)"}
                />
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-secondary)" }}>Your Feedback</label>
              <textarea
                placeholder="Tell us what you think, what's missing, or what could be better…"
                value={form.message}
                onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "rgba(249,115,22,0.5)"}
                onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--border)"}
              />
            </div>

            <button
              onClick={submit}
              disabled={!form.name || !form.email || !rating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#f97316" }}
              onMouseEnter={e => { if (form.name && form.email && rating) (e.currentTarget as HTMLButtonElement).style.background = "#ea6c0f"; }}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#f97316"}>
              Submit Feedback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
