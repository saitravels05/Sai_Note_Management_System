"use client";

import { useState } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { type FinancialPeriodSummaryDTO } from "@/types/month-end";

interface MonthEndOverviewProps {
  businessName: string;
  periods: FinancialPeriodSummaryDTO[];
}

export function MonthEndOverview({
  businessName,
  periods,
}: MonthEndOverviewProps) {
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const closedPeriods = periods.filter((p) => p.status === "CLOSED");
  const lockedPeriods = periods.filter((p) => p.status === "LOCKED");

  const availableYears = Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a);

  const filteredPeriods = selectedYear === "ALL"
    ? periods
    : periods.filter((p) => p.year === Number(selectedYear));

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {businessName}
            </span>
            <span className="text-xs text-slate-400">• Financial Accounting Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Month-End Closing & Period Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automate period calculations, validate data integrity, freeze audited books, and preserve closing snapshots.
          </p>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:border-amber-500 focus:outline-none"
          >
            <option value="ALL">All Financial Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Active Open Month</span>
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {openPeriods.length > 0 ? openPeriods[0].periodLabel : "None"}
          </div>
          <div className="text-[11px] text-slate-500">
            {openPeriods.length} period(s) accepting transactions
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Closed Months</span>
            <Lock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {closedPeriods.length}
          </div>
          <div className="text-[11px] text-slate-500">
            Audited & protected from modification
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Locked Historical</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400">
            {lockedPeriods.length}
          </div>
          <div className="text-[11px] text-slate-500">
            Strict historical compliance archive
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Accounting Integrity</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">
            Verified
          </div>
          <div className="text-[11px] text-slate-500">
            Phase 5 engine reconciliation healthy
          </div>
        </div>
      </div>

      {/* Financial Periods List */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Financial Accounting Periods Timeline</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {filteredPeriods.length} period(s) cataloged
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {filteredPeriods.map((period) => {
            const periodSlug = `${period.year}-${String(period.month).padStart(2, "0")}`;

            return (
              <div
                key={period.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-950/30 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border mt-0.5 sm:mt-0 ${
                      period.status === "OPEN"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : period.status === "CLOSED"
                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                        : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    }`}
                  >
                    {period.status === "OPEN" ? (
                      <Unlock className="w-5 h-5" />
                    ) : period.status === "CLOSED" ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/month-end/${periodSlug}`}
                        className="font-bold text-sm text-white hover:text-amber-400 transition-colors"
                      >
                        {period.periodLabel}
                      </Link>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          period.status === "OPEN"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : period.status === "CLOSED"
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {period.status}
                      </span>

                      {period.closing && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          v{period.closing.version || 1}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      {period.status === "OPEN" ? (
                        <span>Open for active transactions & adjustments</span>
                      ) : (
                        <span>
                          Closed on {period.closedAt ? new Date(period.closedAt).toLocaleDateString() : "-"}
                          {period.closing?.netResult && (
                            <> • Net Result: <strong className="text-white font-mono">₹{period.closing.netResult}</strong></>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Link
                    href={`/month-end/${periodSlug}`}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                  >
                    <span>{period.status === "OPEN" ? "Review & Close" : "View Closing Details"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
