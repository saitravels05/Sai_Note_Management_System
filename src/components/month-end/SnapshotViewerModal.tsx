"use client";

import { useState } from "react";
import {
  X,
  ShieldCheck,
  Copy,
  Check,
  History,
} from "lucide-react";
import { type ClosingSnapshotDTO } from "@/types/month-end";

interface SnapshotViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: ClosingSnapshotDTO | null;
}

export function SnapshotViewerModal({
  isOpen,
  onClose,
  snapshot,
}: SnapshotViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "RECEIVABLES" | "PAYABLES" | "CATEGORIES" | "HISTORY" | "JSON">("SUMMARY");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !snapshot) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Audited Closing Snapshot — {snapshot.periodLabel}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                  Version {snapshot.version}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span>Closed: {new Date(snapshot.closedAt).toLocaleString()}</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs" title={snapshot.integrityHash}>
                  SHA-256: {snapshot.integrityHash.slice(0, 16)}...
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-950/20 text-xs overflow-x-auto">
          {[
            { id: "SUMMARY", label: "Executive Summary" },
            { id: "CATEGORIES", label: "Categories" },
            { id: "RECEIVABLES", label: `Receivables (${snapshot.receivables.items.length})` },
            { id: "PAYABLES", label: `Payables (${snapshot.payables.items.length})` },
            { id: "HISTORY", label: `Version Chain (${snapshot.history?.length || 0})` },
            { id: "JSON", label: "Canonical JSON" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-2.5 font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === "SUMMARY" && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Income</div>
                  <div className="font-bold text-emerald-400 text-sm font-mono mt-1">
                    {snapshot.summary.totalIncome}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Expenses</div>
                  <div className="font-bold text-rose-400 text-sm font-mono mt-1">
                    {snapshot.summary.totalExpenses}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Result</div>
                  <div className="font-bold text-white text-sm font-mono mt-1">
                    {snapshot.summary.netResult}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Closing Position</div>
                  <div className="font-bold text-amber-400 text-sm font-mono mt-1">
                    {snapshot.summary.closingBalance}
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/30">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-800/60">
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Period Opening Balance</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-200">
                        {snapshot.summary.openingBalance}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Total Money Received (Inflows)</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        {snapshot.summary.moneyReceived}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Total Money Paid (Outflows)</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-400">
                        {snapshot.summary.moneyPaid}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Outstanding Receivables</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-400">
                        {snapshot.summary.totalReceivables}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Outstanding Payables</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-400">
                        {snapshot.summary.totalPayables}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Total Transactions Count</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-200">
                        {snapshot.summary.transactionCount} entries
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-300">Accounting Basis</td>
                      <td className="p-3 text-right font-bold text-indigo-400 uppercase">
                        {snapshot.accountingBasis}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {snapshot.closingNotes && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Closing Disclosures</div>
                  <p className="text-slate-300 text-xs italic">{snapshot.closingNotes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "CATEGORIES" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-emerald-400 text-xs uppercase tracking-wider mb-2">
                  Income by Category
                </h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-center">Count</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {snapshot.categories.income.map((c) => (
                        <tr key={c.category} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-medium text-slate-200">{c.category}</td>
                          <td className="p-2.5 text-center text-slate-400">{c.count}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">{c.amount}</td>
                          <td className="p-2.5 text-right text-slate-400 font-mono">{c.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-rose-400 text-xs uppercase tracking-wider mb-2">
                  Expenses by Category
                </h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-center">Count</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {snapshot.categories.expenses.map((c) => (
                        <tr key={c.category} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-medium text-slate-200">{c.category}</td>
                          <td className="p-2.5 text-center text-slate-400">{c.count}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-400">{c.amount}</td>
                          <td className="p-2.5 text-right text-slate-400 font-mono">{c.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "RECEIVABLES" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Outstanding</span>
                  <div className="font-bold text-amber-400 text-base font-mono">
                    {snapshot.receivables.totalOutstanding}
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] text-center font-mono">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Current</div>
                    <div className="font-bold text-slate-200">{snapshot.receivables.aging.current}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">1-30</div>
                    <div className="font-bold text-slate-200">{snapshot.receivables.aging.days1To30}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">31-60</div>
                    <div className="font-bold text-slate-200">{snapshot.receivables.aging.days31To60}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">61-90</div>
                    <div className="font-bold text-slate-200">{snapshot.receivables.aging.days61To90}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">90+</div>
                    <div className="font-bold text-rose-400">{snapshot.receivables.aging.days90Plus}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5 text-right">Original</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {snapshot.receivables.items.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-2.5 font-medium text-slate-200">{r.customerName}</td>
                        <td className="p-2.5 font-mono text-slate-400">{r.customerCode}</td>
                        <td className="p-2.5 text-right font-mono text-slate-300">{r.originalAmount}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-400">{r.paidAmount}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-400">{r.outstandingAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "PAYABLES" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Outstanding</span>
                  <div className="font-bold text-amber-400 text-base font-mono">
                    {snapshot.payables.totalOutstanding}
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] text-center font-mono">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Current</div>
                    <div className="font-bold text-slate-200">{snapshot.payables.aging.current}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">1-30</div>
                    <div className="font-bold text-slate-200">{snapshot.payables.aging.days1To30}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">31-60</div>
                    <div className="font-bold text-slate-200">{snapshot.payables.aging.days31To60}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">61-90</div>
                    <div className="font-bold text-slate-200">{snapshot.payables.aging.days61To90}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">90+</div>
                    <div className="font-bold text-rose-400">{snapshot.payables.aging.days90Plus}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Supplier</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5 text-right">Original</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {snapshot.payables.items.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-2.5 font-medium text-slate-200">{p.supplierName}</td>
                        <td className="p-2.5 font-mono text-slate-400">{p.supplierCode}</td>
                        <td className="p-2.5 text-right font-mono text-slate-300">{p.originalAmount}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-400">{p.paidAmount}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-400">{p.outstandingAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "HISTORY" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Closing Version Chain & Audit Trail</span>
              </div>
              {(!snapshot.history || snapshot.history.length === 0) ? (
                <div className="p-6 text-center text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800">
                  Initial Version 1. No historical superseded versions.
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshot.history.map((h, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400 font-mono text-xs">
                          Superseded Version {h.version}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Closed: {new Date(h.closedAt).toLocaleDateString()} • Reopened: {new Date(h.reopenedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 italic">
                        Reopen Reason: {h.reopenReason}
                      </p>
                      <div className="grid grid-cols-4 gap-2 text-[11px] font-mono pt-2 border-t border-slate-800/60">
                        <div>Income: {String(h.summary.totalIncome)}</div>
                        <div>Expenses: {String(h.summary.totalExpenses)}</div>
                        <div>Net: {String(h.summary.netResult)}</div>
                        <div>Entries: {String(h.summary.transactionCount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "JSON" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  Canonical immutable snapshot payload:
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy Payload"}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Authoritative Month-End Closing Evidence
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
