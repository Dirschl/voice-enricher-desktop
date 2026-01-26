import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Enricher Desktop",
  description: "Hotkey → speech → transcript → AI enrichment (Ollama default).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
