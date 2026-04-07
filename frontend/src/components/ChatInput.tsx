"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend:   (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText]         = useState("");
  const [sparked, setSparked]   = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setSparked(true);
    setTimeout(() => setSparked(false), 400);
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice input (Web Speech API)
  const toggleVoice = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR() as SpeechRecognition;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(prev => prev ? prev + " " + transcript : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, [listening]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div
      className="relative rounded-2xl transition-all duration-200"
      style={{
        background: "var(--bg-secondary)",
        border:     `1px solid ${canSend ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
        boxShadow:  canSend ? "0 0 0 3px rgba(249,115,22,0.08)" : "none",
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={disabled ? "Thinking…" : "Ask about the OmniPro 220 — duty cycle, setup, troubleshooting…"}
        rows={1}
        className="w-full resize-none bg-transparent outline-none text-sm px-4 pt-3.5 pb-3 pr-24 leading-relaxed"
        style={{
          color:            "var(--text-primary)",
          caretColor:       "var(--accent)",
          minHeight:        "52px",
        }}
      />

      {/* Right-side actions */}
      <div className="absolute right-2 bottom-2 flex items-center gap-1">
        {/* Voice button */}
        <button
          onClick={toggleVoice}
          title="Voice input"
          className={`
            w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150
            ${listening ? "text-white" : "text-zinc-500 hover:text-zinc-300"}
          `}
          style={listening ? {
            background: "rgba(249,115,22,0.2)",
            color:      "#f97316",
            boxShadow:  "0 0 8px rgba(249,115,22,0.4)",
          } : { background: "transparent" }}
        >
          {listening ? (
            // Pulsing mic
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            relative w-8 h-8 rounded-xl flex items-center justify-center
            transition-all duration-150 overflow-hidden
            ${canSend ? "btn-arc" : "opacity-30 cursor-not-allowed"}
          `}
          style={canSend ? { background: "var(--accent)" } : { background: "var(--border)" }}
        >
          {/* Spark burst */}
          {sparked && (
            <span className="absolute inset-0 rounded-xl animate-spark"
              style={{ background: "#fb923c", opacity: 0.6 }} />
          )}
          {disabled ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
              className="animate-spin opacity-80">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Hint */}
      {!disabled && (
        <p className="absolute -bottom-5 right-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      )}
    </div>
  );
}
