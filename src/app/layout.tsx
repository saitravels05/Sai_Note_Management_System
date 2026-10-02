import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Sai Notes & Accounting System | Sai Tours & Travels",
  description: "AI-Powered Notes, Operations Ledger & Month-End Accounting Management System",
  icons: {
    icon: "/brand/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0b0f19] text-slate-100 selection:bg-orange-500/30 selection:text-orange-200">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
