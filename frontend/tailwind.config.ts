import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Arc orange — main accent
        arc: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Dark mode surface
        forge: {
          900: "#0a0a0b",
          800: "#111113",
          700: "#18181b",
          600: "#1e1e22",
          500: "#27272a",
          400: "#3f3f46",
          300: "#52525b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      animation: {
        "arc-pulse":     "arc-pulse 2s ease-in-out infinite",
        "spark":         "spark 0.4s ease-out forwards",
        "slide-in-right":"slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-up":       "fade-up 0.25s ease-out forwards",
        "dot-bounce":    "dot-bounce 1.2s ease-in-out infinite",
        "thinking-bar":  "thinking-bar 1.5s ease-in-out infinite",
        "marquee":       "marquee 28s linear infinite",
        "ken-burns":     "ken-burns 22s ease-in-out infinite",
      },
      keyframes: {
        "arc-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%":       { opacity: "1",   transform: "scale(1.08)" },
        },
        "marquee": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "ken-burns": {
          "0%":   { transform: "scale(1.04) translate(0%, 0%)" },
          "35%":  { transform: "scale(1.10) translate(-1.2%, -0.6%)" },
          "65%":  { transform: "scale(1.08) translate(0.8%, 0.4%)" },
          "100%": { transform: "scale(1.04) translate(0%, 0%)" },
        },
        "spark": {
          "0%":   { transform: "scale(1)",    opacity: "1" },
          "50%":  { transform: "scale(1.4)",  opacity: "0.8" },
          "100%": { transform: "scale(0.8)",  opacity: "0" },
        },
        "slide-in-right": {
          "0%":   { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)",    opacity: "1" },
        },
        "fade-up": {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%":            { transform: "translateY(-6px)" },
        },
        "thinking-bar": {
          "0%":   { width: "0%",   opacity: "1" },
          "70%":  { width: "85%",  opacity: "1" },
          "100%": { width: "100%", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
