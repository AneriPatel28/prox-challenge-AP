"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WeldingArcIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="4" y="18" width="12" height="5" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="14" y="19" width="6" height="3" rx="1" fill="currentColor" opacity="0.7" />
    <line x1="20" y1="20.5" x2="28" y2="14" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    <line x1="20" y1="20.5" x2="27" y2="20" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <line x1="20" y1="20.5" x2="26" y2="25" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <circle cx="27" cy="14" r="2.5" fill="#fb923c" />
    <circle cx="27" cy="14" r="4" fill="#f97316" opacity="0.25" className="animate-arc-pulse" />
  </svg>
);

const NAV_ITEMS = [
  {
    href: "/chat",
    label: "AI Assistant",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/manual",
    label: "Manual Explorer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle:  () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0
        ${collapsed ? "w-[60px]" : "w-[220px]"}`}
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <Link href="/" className={`flex items-center gap-3 px-4 py-5 hover:opacity-80 transition-opacity ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="relative flex-shrink-0" style={{ color: "var(--text-primary)" }}>
          <WeldingArcIcon />
        </div>
        {!collapsed && (
          <div className="animate-fade-up">
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>OmniPro 220</p>
            <p className="text-[10px]" style={{ color: "#f97316" }}>AI Assistant</p>
          </div>
        )}
      </Link>

      {/* Divider */}
      <div className="mx-3 mb-4" style={{ height: "1px", background: "var(--border)" }} />

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href === "/chat" && pathname === "/chat");

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`
                flex items-center gap-2.5 rounded-full transition-all duration-150 text-left
                ${collapsed ? "justify-center p-2.5" : "px-3 py-1.5"}
              `}
              style={isActive ? {
                background: "rgba(249,115,22,0.1)",
                border:     "1px solid rgba(249,115,22,0.25)",
              } : {
                background: "transparent",
                border:     "1px solid transparent",
              }}
              title={collapsed ? item.label : undefined}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                }
              }}
            >
              <span style={isActive ? { color: "#f97316" } : { color: "var(--text-muted)" }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span
                  className="text-xs font-medium"
                  style={{ color: isActive ? "#f97316" : "var(--text-secondary)" }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Machine tag */}
      {!collapsed && (
        <div className="mx-3 mb-4 p-3 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-mono mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Machine</p>
          <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Vulcan OmniPro 220</p>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Multi-process welder</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="mx-3 mb-4 flex items-center justify-center h-8 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </aside>
  );
}
