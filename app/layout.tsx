import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "lmkurname — check your name everywhere",
  description:
    "Score a name and check its availability across domains, GitHub, npm and social handles. The web UI for the lmkurname MCP server.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="page-glow">{children}</div>
      </body>
    </html>
  );
}
