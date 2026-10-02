"use client";

import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { AlertTriangle, Clock, ArrowUpRight } from "lucide-react";
import { type DueItem } from "@/server/services/analytics.service";

interface UpcomingAndOverdueWidgetProps {
  overdueItems: DueItem[];
  upcomingItems: DueItem[];
}

export function UpcomingAndOverdueWidget({
  overdueItems,
  upcomingItems,
}: UpcomingAndOverdueWidgetProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Overdue Items */}
      <div className="p-6 rounded-2xl glass-card border border-rose-500/20 bg-rose-950/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Critical Overdue Invoices ({overdueItems.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Debts that have exceeded agreed maturity terms
              </p>
            </div>
          </div>

          <Link
            href="/receivables"
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {overdueItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            ✓ No overdue invoices. All accounts are currently within terms.
          </div>
        ) : (
          <div className="space-y-2.5">
            {overdueItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-rose-500/30 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{item.partyName}</span>
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                      {item.daysRemainingOrOverdue}d overdue
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ref: {item.referenceNumber || item.transactionNumber} • Due {item.dueDate}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-black text-rose-400">
                      ₹{formatINR(item.outstandingAmount)}
                    </div>
                    <div className="text-[10px] text-slate-500">Outstanding</div>
                  </div>

                  <Link
                    href={item.partyType === "CUSTOMER" ? "/receivables" : "/payables"}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-colors"
                  >
                    Collect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Upcoming Dues */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Upcoming Settlements & Dues ({upcomingItems.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Receivables and payables maturing in the next 14 days
              </p>
            </div>
          </div>

          <Link
            href="/receivables"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {upcomingItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            No upcoming settlement dates found for the immediate window.
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/30 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{item.partyName}</span>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">
                      in {item.daysRemainingOrOverdue}d
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {item.partyType} • Due {item.dueDate}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-white">
                    ₹{formatINR(item.outstandingAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
