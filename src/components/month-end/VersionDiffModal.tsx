"use client";

import {
  GitCompare,
  X,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { type VersionDiffResult } from "@/types/month-end";

interface VersionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diff: VersionDiffResult | null;
}

export function VersionDiffModal({
  isOpen,
  onClose,
  diff,
}: VersionDiffModalProps) {
  if (!isOpen || !diff) return null;

  const renderDiffBadge = (valStr: string) => {
    if (valStr.startsWith("-")) {
      return (
        <span className="flex items-center gap-1 text-rose-400 font-mono font-bold text-xs">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{valStr}</span>
        </span>
      );
    }
    if (valStr === "0.00" || valStr === "0") {
      return (
        <span className="flex items-center gap-1 text-slate-500 font-mono font-bold text-xs">
          <Minus className="w-3.5 h-3.5" />
          <span>No Change</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-xs">
        <TrendingUp className="w-3.5 h-3.5" />
        <span>+{valStr}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Closing Version Comparison</h2>
                <span className="text-xs text-purple-400 font-mono font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {diff.periodLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit reconciliation between superseded Version {diff.v1.version} and current Version {diff.v2.version}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Headers */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 font-mono">Version {diff.v1.version} (Prior)</span>
              <span className="text-[10px] text-slate-500">{new Date(diff.v1.closedAt).toLocaleDateString()}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">Closed by: {diff.v1.closedBy}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 font-mono">Version {diff.v2.version} (Active)</span>
              <span className="text-[10px] text-slate-500">{new Date(diff.v2.closedAt).toLocaleDateString()}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">Closed by: {diff.v2.closedBy}</div>
          </div>
        </div>

        {/* Differences Table */}
        <div className="rounded-xl border border-slate-800 overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="p-3">Financial Metric</th>
                <th className="p-3 text-right">V{diff.v1.version} Figure</th>
                <th className="p-3 text-center"></th>
                <th className="p-3 text-right">V{diff.v2.version} Figure</th>
                <th className="p-3 text-right">Variance / Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Total Income</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.income}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.income}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.incomeDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Total Expenses</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.expenses}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.expenses}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.expensesDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Net Accounting Result</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.netResult}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.netResult}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.netResultDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Receivables Outstanding</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.receivables}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.receivables}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.receivablesDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Payables Outstanding</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.payables}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.payables}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.payablesDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Closing Cash Position</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.cashPosition}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.cashPosition}</td>
                <td className="p-3 text-right">{renderDiffBadge(diff.differences.cashPositionDiff)}</td>
              </tr>
              <tr className="hover:bg-slate-900/50">
                <td className="p-3 font-semibold text-slate-200">Total Transaction Count</td>
                <td className="p-3 text-right font-mono text-slate-400">{diff.v1.transactionCount}</td>
                <td className="p-3 text-center text-slate-600"><ArrowRight className="w-3.5 h-3.5 inline" /></td>
                <td className="p-3 text-right font-mono font-bold text-slate-200">{diff.v2.transactionCount}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-300">
                  {diff.differences.transactionCountDiff > 0 ? `+${diff.differences.transactionCountDiff}` : diff.differences.transactionCountDiff} entries
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
