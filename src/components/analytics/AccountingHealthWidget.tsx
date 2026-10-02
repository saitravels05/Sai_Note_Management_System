"use client";

import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { type ReconciliationReport } from "@/server/services/reconciliation.service";

interface AccountingHealthWidgetProps {
  status: "BALANCED" | "WARNINGS_FOUND" | "REVIEW_REQUIRED";
  report: ReconciliationReport;
}

export function AccountingHealthWidget({ status, report }: AccountingHealthWidgetProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "BALANCED":
        return {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          title: "General Ledger Balanced",
          badge: "All Integrity Checks Passing",
          border: "border-emerald-500/20 bg-emerald-950/10",
          textColor: "text-emerald-400",
          badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "WARNINGS_FOUND":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          title: "Accounting Warnings Detected",
          badge: `${report.discrepancies.length} Items Require Review`,
          border: "border-amber-500/20 bg-amber-950/10",
          textColor: "text-amber-400",
          badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        };
      case "REVIEW_REQUIRED":
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          title: "Integrity Discrepancy Found",
          badge: "Action Required",
          border: "border-rose-500/20 bg-rose-950/10",
          textColor: "text-rose-400",
          badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className={`p-5 rounded-2xl glass-card border ${badge.border} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
          {badge.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">{badge.title}</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.badgeBg}`}>
              {badge.badge}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic check across {report.summary.totalTransactionsChecked} transactions, {report.summary.totalPaymentsChecked} payments & {report.summary.totalAllocationsChecked} allocations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{report.passedChecks} of {report.totalChecks} Checks Passed</span>
        </div>
      </div>
    </div>
  );
}
