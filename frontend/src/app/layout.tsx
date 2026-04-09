import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ChatProvider } from "@/context/ChatContext";
import "./globals.css";

export const metadata: Metadata = {
  title:       "OmniPro 220 — AI Assistant",
  description: "Multimodal AI assistant for the Vulcan OmniPro 220 welder",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'><rect x='4' y='18' width='12' height='5' rx='2' fill='%23f97316' opacity='0.9'/><rect x='14' y='19' width='6' height='3' rx='1' fill='%23f97316' opacity='0.7'/><line x1='20' y1='20.5' x2='28' y2='14' stroke='%23f97316' strokeWidth='2' strokeLinecap='round'/><circle cx='27' cy='14' r='2.5' fill='%23fb923c'/><circle cx='27' cy='14' r='4' fill='%23f97316' opacity='0.25'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ChatProvider>
            {children}
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
