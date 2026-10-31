import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseMemory — Agentic Criminal Case Intelligence",
  description: "Continuous episodic memory, structured evidentiary retrieval, and explainable suspect analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-secondary-container selection:text-on-secondary-container bg-surface text-on-surface">
        {children}
      </body>
    </html>
  );
}
