"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  Building2,
  Calendar,
  Lock,
  Download,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  AIFinancialSummaryData,
  AIRecordsData,
  AIReceivablePayableData,
  AILedgerData,
  AIComparisonData,
  AIMonthEndStatusData,
  AIDuplicateData,
  AINoteItemDTO,
  AIExportPreparationData,
} from "@/types/ai";

// ===================================================================
// 1. FINANCIAL SUMMARY CARD
// ===================================================================

export function AIFinancialSummaryCard({ data }: { data: AIFinancialSummaryData }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold text-white">{data.periodLabel}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {data.accountingBasis}
          </span>
        </div>
        {data.isAsClosed && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Frozen Snapshot v{data.snapshotVersion || 1}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block">Recognized Income</span>
          <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
            {data.totalIncome}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block">Recognized Expenses</span>
          <span className="text-sm font-bold font-mono text-rose-400 mt-0.5 block">
            {data.totalExpenses}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block">Net Result</span>
          <span className="text-sm font-bold font-mono text-cyan-400 mt-0.5 block">
            {data.netResult}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block">Closing Cash</span>
          <span className="text-sm font-bold font-mono text-amber-400 mt-0.5 block">
            {data.closingCashPosition}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/60 text-slate-400">
        <div>
          <span>Receivables: </span>
          <strong className="text-white font-mono">{data.receivablesOutstanding}</strong>
        </div>
        <div>
          <span>Payables: </span>
          <strong className="text-white font-mono">{data.payablesOutstanding}</strong>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. RECORDS LIST CARD
// ===================================================================

export function AIRecordsCard({ data }: { data: AIRecordsData }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white">
            {data.totalCount} Record(s) ({data.summaryAmount})
          </span>
        </div>
        <Link
          href={data.filterUrl}
          className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1"
        >
          <span>View All in Ledger</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto pr-1">
        {data.records.map((r) => (
          <div key={r.id} className="py-2 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 text-[11px]">{r.transactionNumber}</span>
                <span className="font-semibold text-white">{r.title}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{r.transactionDate}</span>
                <span>•</span>
                <span>{r.categoryName}</span>
                {r.partyName && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">{r.partyName}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <span
                className={`font-mono font-bold block ${
                  r.transactionType === "INCOME" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r.amount}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                {r.paymentStatus}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 3. RECEIVABLES & PAYABLES CARD
// ===================================================================

export function AIReceivablePayableCard({ data }: { data: AIReceivablePayableData }) {
  const isCust = data.partyType === "CUSTOMER";

  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {isCust ? <Users className="w-4 h-4 text-emerald-400" /> : <Building2 className="w-4 h-4 text-amber-400" />}
          <span className="text-xs font-bold text-white">
            {isCust ? "Customer Receivables" : "Supplier Payables"}
          </span>
          {data.isAsClosed && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
              As Closed
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 mr-1.5">Total Outstanding:</span>
          <strong className="text-sm font-mono text-white">{data.totalOutstanding}</strong>
        </div>
      </div>

      {data.agingSchedule && (
        <div className="grid grid-cols-5 gap-1 text-center bg-slate-950/50 p-2 rounded-xl text-[10px]">
          <div>
            <span className="text-slate-500 block">Current</span>
            <span className="font-mono font-bold text-white">{data.agingSchedule.current}</span>
          </div>
          <div>
            <span className="text-slate-500 block">1-30 Days</span>
            <span className="font-mono font-bold text-white">{data.agingSchedule.days1To30}</span>
          </div>
          <div>
            <span className="text-slate-500 block">31-60 Days</span>
            <span className="font-mono font-bold text-amber-400">{data.agingSchedule.days31To60}</span>
          </div>
          <div>
            <span className="text-slate-500 block">61-90 Days</span>
            <span className="font-mono font-bold text-orange-400">{data.agingSchedule.days61To90}</span>
          </div>
          <div>
            <span className="text-slate-500 block">90+ Days</span>
            <span className="font-mono font-bold text-rose-400">{data.agingSchedule.days90Plus}</span>
          </div>
        </div>
      )}

      {data.items.length > 0 && (
        <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto pr-1">
          {data.items.map((it) => (
            <div key={it.partyId} className="py-2 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white block">{it.partyName}</span>
                <span className="text-[11px] text-slate-500 font-mono">{it.partyCode}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-amber-400 block">{it.outstanding}</span>
                {it.overdueAmount && it.overdueAmount !== "₹0.00" && (
                  <span className="text-[10px] text-rose-400">Overdue: {it.overdueAmount}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================================================================
// 4. LEDGER CARD
// ===================================================================

export function AILedgerCard({ data }: { data: AILedgerData }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div>
          <span className="text-sm font-bold text-white">{data.partyName}</span>
          <span className="text-xs text-slate-400 block">{data.partyType} Ledger</span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400 block">Current Balance</span>
          <strong className="text-sm font-mono text-amber-400">{data.currentBalance}</strong>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-2 rounded-xl text-center text-xs">
        <div>
          <span className="text-slate-500 text-[10px] block">Opening</span>
          <span className="font-mono font-bold text-slate-300">{data.openingBalance}</span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] block">Total Invoiced</span>
          <span className="font-mono font-bold text-rose-400">{data.totalBilled}</span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] block">Total Paid</span>
          <span className="font-mono font-bold text-emerald-400">{data.totalPaid}</span>
        </div>
      </div>

      {data.recentEntries.length > 0 && (
        <div className="divide-y divide-slate-800/60 max-h-40 overflow-y-auto text-xs">
          {data.recentEntries.map((e, idx) => (
            <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-400 mr-2">{e.date}</span>
                <span className="text-white font-medium">{e.reference || e.description}</span>
              </div>
              <div className="font-mono text-right">
                <span className={e.debit !== "₹0.00" ? "text-rose-400" : "text-emerald-400"}>
                  {e.debit !== "₹0.00" ? `+${e.debit}` : `-${e.credit}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 text-right">
        <Link
          href={data.ledgerUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          <span>Open Full Statement & Ledger</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ===================================================================
// 5. PERIOD COMPARISON CARD
// ===================================================================

export function AIComparisonCard({ data }: { data: AIComparisonData }) {
  const metrics = [
    { label: "Recognized Income", ...data.income, positiveIsGood: true },
    { label: "Recognized Expenses", ...data.expenses, positiveIsGood: false },
    { label: "Net Result", ...data.netResult, positiveIsGood: true },
    { label: "Cash Received", ...data.moneyIn, positiveIsGood: true },
    { label: "Cash Paid", ...data.moneyOut, positiveIsGood: false },
    { label: "Receivables", ...data.receivables, positiveIsGood: false },
  ];

  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-white">
          Comparison: {data.currentPeriodLabel} vs {data.previousPeriodLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {metrics.map((m, idx) => {
          const isUp = m.trend === "UP";
          const isFlat = m.trend === "FLAT";
          const isPositive = m.positiveIsGood ? isUp : !isUp;

          return (
            <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[11px] block">{m.label}</span>
                <span className="font-mono font-bold text-white">{m.current}</span>
                <span className="text-[10px] text-slate-500 block">Prev: {m.previous}</span>
              </div>
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${
                    isFlat ? "text-slate-400" : isPositive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : !isFlat ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  <span>{m.percentChange !== null ? `${m.percentChange > 0 ? "+" : ""}${m.percentChange}%` : "N/A"}</span>
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">{m.diff}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================================================================
// 6. MONTH-END STATUS CARD
// ===================================================================

export function AIMonthEndStatusCard({ data }: { data: AIMonthEndStatusData }) {
  const isReady = data.overallStatus === "READY";
  const isBlocked = data.overallStatus === "BLOCKED";

  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-white">{data.periodLabel} Month-End Status</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isReady
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isBlocked
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {data.overallStatus}
          </span>
        </div>
        <Link
          href={data.monthEndUrl}
          className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1"
        >
          <span>Open Month-End</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-slate-500 text-[10px] block">Passed Checks</span>
          <span className="font-mono font-bold text-emerald-400">{data.passedCount}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-slate-500 text-[10px] block">Warnings</span>
          <span className="font-mono font-bold text-amber-400">{data.warningCount}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-slate-500 text-[10px] block">Blocking Issues</span>
          <span className="font-mono font-bold text-rose-400">{data.blockingCount}</span>
        </div>
      </div>

      {data.blockingReasons.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-rose-400 block">Blocking Issues to Resolve:</span>
          {data.blockingReasons.map((b, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-start gap-2 text-xs">
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">{b.title}</strong>
                <span className="text-slate-400 text-[11px]">{b.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================================================================
// 7. DUPLICATES CARD
// ===================================================================

export function AIDuplicateCard({ data }: { data: AIDuplicateData }) {
  if (data.duplicateGroupCount === 0) {
    return (
      <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>No potential duplicate records detected in posted transactions.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <Copy className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-white">
          {data.duplicateGroupCount} Potential Duplicate Group(s)
        </span>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {data.groups.map((g, idx) => (
          <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{g.date}</span>
              <span className="font-mono font-bold text-amber-400">{g.amount}</span>
            </div>
            <div className="divide-y divide-slate-800/40 text-[11px]">
              {g.records.map((r) => (
                <div key={r.id} className="py-1 flex items-center justify-between text-slate-300">
                  <span className="font-mono text-slate-500 mr-2">{r.transactionNumber}</span>
                  <span className="truncate">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 8. NOTES LIST CARD
// ===================================================================

export function AINotesCard({ notes }: { notes: AINoteItemDTO[] }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <FileText className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-bold text-white">{notes.length} Matching Operational Note(s)</span>
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {notes.map((n) => (
          <div key={n.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{n.title}</span>
              <span className="text-[10px] text-slate-500">{n.createdAt}</span>
            </div>
            <p className="text-slate-400 text-[11px] line-clamp-2">{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 9. EXPORT PREPARATION CARD
// ===================================================================

export function AIExportCard({ data }: { data: AIExportPreparationData }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-white">Export Proposal Prepared</span>
        </div>
      </div>

      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
        <div>
          <span>Report: </span>
          <strong className="text-white">{data.reportType}</strong>
        </div>
        <div>
          <span>Period: </span>
          <strong className="text-white">{data.periodLabel}</strong>
        </div>
        <div>
          <span>Formats: </span>
          <span className="font-mono text-cyan-400">{data.suggestedFormats.join(", ")}</span>
        </div>
      </div>

      <div className="pt-1 text-right">
        <Link
          href={data.exportUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow hover:from-orange-600"
        >
          <span>Proceed to Export Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ===================================================================
// 10. CLARIFICATION CARD
// ===================================================================

export function AIClarificationCard({
  prompt,
  options,
  onSelectOption,
}: {
  prompt: string;
  options: Array<{ label: string; value: string }>;
  onSelectOption: (val: string) => void;
}) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{prompt}</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSelectOption(opt.value)}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:border-orange-500 hover:text-white transition-all text-left cursor-pointer"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// 11. PERMISSION DENIED CARD
// ===================================================================

export function AIPermissionDeniedCard({
  missingPermission,
  explanation,
}: {
  missingPermission: string;
  explanation: string;
}) {
  return (
    <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1 text-rose-300">
      <div className="flex items-center gap-2 font-bold text-rose-400">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>Permission Denied ({missingPermission})</span>
      </div>
      <p className="text-[11px] text-slate-300">{explanation}</p>
    </div>
  );
}
