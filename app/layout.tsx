import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseMemory - Agentic Memory for Criminal Investigations",
  description: "AI-powered structured case memory, vector search, and evidentiary investigation assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}

