"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  type PreCloseChecklistResult,
  type ChecklistItem,
} from "@/types/month-end";
import Link from "next/link";

interface PreCloseChecklistViewProps {
  checklist: PreCloseChecklistResult;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function PreCloseChecklistView({
  checklist,
  onRefresh,
  isRefreshing = false,
}: PreCloseChecklistViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getSeverityBadge = (sev: ChecklistItem["severity"]) => {
    switch (sev) {
      case "PASS":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case "WARNING":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARNING
          </span>
        );
      case "BLOCKING":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            BLOCKING
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Health Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          checklist.overallStatus === "READY"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            : checklist.overallStatus === "WARNINGS"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
            : "bg-rose-500/10 border-rose-500/30 text-rose-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              checklist.overallStatus === "READY"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : checklist.overallStatus === "WARNINGS"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-rose-500/20 border-rose-500/40 text-rose-400"
            }`}
          >
            {checklist.overallStatus === "READY" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : checklist.overallStatus === "WARNINGS" ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">
                Pre-Close Integrity:{" "}
                {checklist.overallStatus === "READY"
                  ? "Ready for Final Close"
                  : checklist.overallStatus === "WARNINGS"
                  ? "Warnings Acknowledged (Close Allowed)"
                  : "Blocked — Action Required"}
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                {checklist.passedChecks} of {checklist.totalChecks} Checks Passed
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {checklist.overallStatus === "READY"
                ? "All accounting integrity checks passed with zero blocking issues. Ready to freeze books."
                : checklist.overallStatus === "WARNINGS"
                ? "Informational warnings detected (e.g. unapplied advances). You may proceed with explicit acknowledgment."
                : "One or more blocking integrity errors prevent period closing. Resolve the highlighted records first."}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors self-start sm:self-center cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Checklist</span>
        </button>
      </div>

      {/* Checklist Items Accordion */}
      <div className="space-y-2.5">
        {checklist.items.map((item) => {
          const isExpanded = expandedId === item.id;
          const hasDetails = item.details && item.details.length > 0;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all ${
                item.severity === "BLOCKING"
                  ? "bg-rose-950/20 border-rose-500/30"
                  : item.severity === "WARNING"
                  ? "bg-amber-950/20 border-amber-500/30"
                  : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
              }`}
            >
              <div
                onClick={() => hasDetails && toggleExpand(item.id)}
                className={`p-4 flex items-center justify-between gap-4 select-none ${
                  hasDetails ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">{getSeverityBadge(item.severity)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {item.count} items
                        </span>
                      )}
                      {item.amount && (
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          {item.amount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {hasDetails && (
                  <button className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Expandable Details Table */}
              {isExpanded && hasDetails && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/60">
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="p-2.5">Reference #</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5 text-right">Amount</th>
                          <th className="p-2.5">Required Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {item.details!.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-900/50">
                            <td className="p-2.5 font-mono font-bold text-slate-200">
                              <Link
                                href={`/records/${d.id}`}
                                className="text-rose-400 hover:underline flex items-center gap-1"
                              >
                                <span>{d.reference}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                            <td className="p-2.5 text-slate-300 max-w-xs truncate">{d.description}</td>
                            <td className="p-2.5 font-mono text-slate-400">{d.date || "-"}</td>
                            <td className="p-2.5 font-mono text-right text-slate-200">{d.amount || "-"}</td>
                            <td className="p-2.5 text-slate-400 italic text-[11px]">{d.reason || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
