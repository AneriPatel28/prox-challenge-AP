import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ChatProvider } from "@/context/ChatContext";
import "./globals.css";

export const metadata: Metadata = {
  title:       "OmniPro 220 — AI Assistant",
  description: "Multimodal AI assistant for the Vulcan OmniPro 220 welder",
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
