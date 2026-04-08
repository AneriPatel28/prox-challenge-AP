"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { Artifact } from "@/types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MermaidRenderer = dynamic(() => import("./MermaidDiagram"), { ssr: false });

interface Props { artifact: Artifact; }

function HtmlArtifact({ artifact }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);

  // Listen for resize messages from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (
        e.source === iframeRef.current?.contentWindow &&
        e.data?.type === "resize" &&
        typeof e.data.height === "number"
      ) {
        setHeight(Math.max(200, Math.min(e.data.height + 40, 800)));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Auto-resize script injected into every iframe
  const resizeScript = `<script>
(function(){
  function send(){window.parent.postMessage({type:'resize',height:document.body.scrollHeight},'*')}
  window.addEventListener('load',send);
  if(document.readyState!=='loading')send();
  new ResizeObserver(send).observe(document.body);
})();
</script>`;

  // Theme CSS injected AFTER Claude's HTML so our variables win
  const overrideCSS = `
<style id="theme-override">
  :root {
    --bg:        ${isDark ? "#0c0c0e" : "#ffffff"} !important;
    --bg-card:   ${isDark ? "#18181b" : "#f9f9f7"} !important;
    --bg-input:  ${isDark ? "#111113" : "#f3f4f6"} !important;
    --text:      ${isDark ? "#f9fafb" : "#111827"} !important;
    --text-muted:${isDark ? "#9ca3af" : "#6b7280"} !important;
    --border:    ${isDark ? "#27272a" : "#e5e7eb"} !important;
    --accent:    ${isDark ? "#f97316" : "#ea580c"} !important;
    --accent-bg: ${isDark ? "rgba(249,115,22,0.15)" : "rgba(234,88,12,0.08)"} !important;
  }
  html { color-scheme: ${isDark ? "dark" : "light"}; }
  body {
    background: ${isDark ? "#0c0c0e" : "#ffffff"} !important;
    color:       ${isDark ? "#f9fafb" : "#111827"} !important;
    font-family: Inter, system-ui, sans-serif !important;
    -webkit-font-smoothing: antialiased;
  }
  ${isDark ? "" : `
  [style*="background: #0"], [style*="background:#0"],
  [style*="background: #1"], [style*="background:#1"],
  [style*="background-color: #0"], [style*="background-color:#0"],
  [style*="background-color: #1"], [style*="background-color:#1"] {
    background: var(--bg-card) !important;
    color: var(--text) !important;
  }`}
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${isDark ? "#27272a" : "#e5e7eb"}; border-radius: 2px; }
</style>`;

  // Inject resize script before </body> if present, otherwise append
  const withResize = artifact.content.includes("</body>")
    ? artifact.content.replace("</body>", resizeScript + "</body>")
    : artifact.content + resizeScript;

  const themedSrc = withResize + "\n" + overrideCSS;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={themedSrc}
      sandbox="allow-scripts allow-forms allow-popups"
      className="w-full rounded-lg border-0 transition-all duration-300"
      style={{ height: `${height}px`, background: isDark ? "#0c0c0e" : "#ffffff" }}
      title={artifact.title}
    />
  );
}

export default function ArtifactFrame({ artifact }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (artifact.type === "text/html") {
    return <HtmlArtifact artifact={artifact} />;
  }

  if (artifact.type === "application/vnd.ant.mermaid") {
    return (
      <div className="w-full h-full overflow-auto p-4">
        <MermaidRenderer chart={artifact.content} />
      </div>
    );
  }

  if (artifact.type === "image" || artifact.type === "image/jpeg" || artifact.type === "image/png") {
    // Prefer figure crops (specific diagrams extracted from the page) over the full page scan
    const figures = artifact.figure_urls?.length
      ? artifact.figure_urls.map(u => u.startsWith("http") ? u : `${API_URL}${u}`)
      : [];

    if (figures.length > 0) {
      return (
        <div className="w-full flex flex-col items-start p-4 gap-4">
          {artifact.title && (
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {artifact.title}
            </p>
          )}
          {figures.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${artifact.title} — figure ${i + 1}`}
              className="max-w-full rounded-lg object-contain"
              style={{ border: "1px solid var(--border)", maxHeight: "500px" }}
            />
          ))}
        </div>
      );
    }

    // Fall back to full page image
    let src: string;
    if (artifact.content && (artifact.content.startsWith("http") || artifact.content.startsWith("/"))) {
      src = artifact.content.startsWith("http") ? artifact.content : `${API_URL}${artifact.content}`;
    } else if (artifact.source && artifact.page) {
      const pageNum = String(artifact.page).padStart(3, "0");
      src = `${API_URL}/images/${artifact.source}-p${pageNum}.jpg`;
    } else {
      src = "";
    }

    if (!src) {
      return (
        <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Image not available
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col items-center p-4 gap-3">
        <img
          src={src}
          alt={artifact.title}
          className="max-w-full rounded-lg object-contain"
          style={{ border: "1px solid var(--border)", maxHeight: "600px" }}
        />
        {artifact.title && (
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            {artifact.title}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
      Unsupported artifact type: {artifact.type}
    </div>
  );
}
