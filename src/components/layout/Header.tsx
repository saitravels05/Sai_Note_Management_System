"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Sparkles,
  Plus,
  Bell,
  Calendar,
  Shield,
} from "lucide-react";
import { AccountMenu } from "./AccountMenu";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/records?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Context */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            Accounting: Sep 2026
          </span>
          <span className="hidden md:inline-block text-slate-600">|</span>
          <span className="hidden md:flex items-center gap-1 text-emerald-400/90 font-medium text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Audit Logging Active
          </span>
        </div>
      </div>

      {/* Center: "Ask your accounts..." Smart Search Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-400 transition-colors">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask your accounts or search: 'Flight ticket above ₹10k', 'UPI payments'..."
            className="w-full pl-9 pr-12 py-1.5 text-sm bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-lg border border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all shadow-inner"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-800 rounded border border-slate-700">
              Enter
            </kbd>
          </div>
        </form>
      </div>

      {/* Right: Quick Action & Profile */}
      <div className="flex items-center gap-3">
        <Link
          href="/quick-entry"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-orange-700 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Add Record</span>
        </Link>

        <Link
          href="/month-end"
          title="Month-End Closing Wizard"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
        >
          Month-End
        </Link>

        {/* Notifications / Anomaly alerts */}
        <button
          aria-label="Alerts"
          title="Audit & Accounting Alerts"
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-[#0b0f19]" />
        </button>

        {/* Real User Account Menu & Sign Out */}
        <AccountMenu />
      </div>
    </header>
  );
}
