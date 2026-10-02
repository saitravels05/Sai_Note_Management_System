"use client";

import { useState } from "react";
import {
  Lock,
  Unlock,
  ShieldCheck,
  RotateCcw,
  GitCompare,
  FileText,
  Download,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  type PreCloseChecklistResult,
  type ClosingSnapshotDTO,
  type VersionDiffResult,
} from "@/types/month-end";
import {
  lockFinancialPeriodAction,
  unlockFinancialPeriodAction,
  getClosingSnapshotAction,
  getClosingVersionDiffAction,
  regenerateClosingReportAction,
  getPeriodChecklistAction,
} from "@/server/actions/month-end.actions";
import { PreCloseChecklistView } from "./PreCloseChecklistView";
import { CloseMonthModal } from "./CloseMonthModal";
import { ReopenMonthModal } from "./ReopenMonthModal";
import { SnapshotViewerModal } from "./SnapshotViewerModal";
import { VersionDiffModal } from "./VersionDiffModal";

interface PeriodDetailDashboardProps {
  year: number;
  month: number;
  initialChecklist: PreCloseChecklistResult;
  initialSnapshot: ClosingSnapshotDTO | null;
  initialDiff: VersionDiffResult | null;
}

export function PeriodDetailDashboard({
  year,
  month,
  initialChecklist,
  initialSnapshot,
  initialDiff,
}: PeriodDetailDashboardProps) {
  const [checklist, setChecklist] = useState<PreCloseChecklistResult>(initialChecklist);
  const [snapshot, setSnapshot] = useState<ClosingSnapshotDTO | null>(initialSnapshot);
  const [versionDiff, setVersionDiff] = useState<VersionDiffResult | null>(initialDiff);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modals state
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const isClosed = checklist.periodStatus === "CLOSED";
  const isLocked = checklist.periodStatus === "LOCKED";
  const isOpen = checklist.periodStatus === "OPEN";

  const refreshChecklist = async () => {
    setIsRefreshing(true);
    try {
      const res = await getPeriodChecklistAction(year, month);
      if (res.success && res.data) {
        setChecklist(res.data);
      }
      const snapRes = await getClosingSnapshotAction(year, month);
      if (snapRes.success && snapRes.data) {
        setSnapshot(snapRes.data);
      }
      const diffRes = await getClosingVersionDiffAction(year, month);
      if (diffRes.success && diffRes.data) {
        setVersionDiff(diffRes.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLock = async () => {
    if (!confirm(`Are you sure you want to lock ${checklist.periodLabel}? This provides highest compliance protection.`)) return;
    setIsActionLoading(true);
    try {
      const res = await lockFinancialPeriodAction({ year, month });
      if (res.success) {
        await refreshChecklist();
      } else {
        alert(res.error || "Failed to lock period.");
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnlock = async () => {
    const reason = prompt(`Enter mandatory audit reason to unlock ${checklist.periodLabel}:`);
    if (!reason || reason.trim().length < 5) {
      alert("A valid explanation (minimum 5 characters) is required to unlock.");
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await unlockFinancialPeriodAction({ year, month, reason });
      if (res.success) {
        await refreshChecklist();
      } else {
        alert(res.error || "Failed to unlock period.");
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRegenerateReports = async () => {
    setIsActionLoading(true);
    try {
      const res = await regenerateClosingReportAction({ year, month, format: "BOTH" });
      if (res.success) {
        alert("Reports regenerated successfully!");
        await refreshChecklist();
      } else {
        alert(res.error || "Failed to regenerate reports.");
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/month-end"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Month-End Center</span>
            </Link>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400 font-mono">
              {year}-{String(month).padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {checklist.periodLabel}
            </h1>
            {isOpen && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Unlock className="w-3.5 h-3.5" />
                OPEN
              </span>
            )}
            {isClosed && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="w-3.5 h-3.5" />
                CLOSED
              </span>
            )}
            {isLocked && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                LOCKED
              </span>
            )}
            {snapshot && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                Version {snapshot.version}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit review, integrity checks, and closing evidence for this accounting period.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {isOpen && (
            <button
              onClick={() => setIsCloseModalOpen(true)}
              disabled={checklist.overallStatus === "BLOCKED" || isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                checklist.overallStatus !== "BLOCKED"
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Close Month</span>
            </button>
          )}

          {isClosed && (
            <>
              <button
                onClick={() => setIsReopenModalOpen(true)}
                disabled={isActionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Period</span>
              </button>

              <button
                onClick={handleLock}
                disabled={isActionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>Lock Period</span>
              </button>
            </>
          )}

          {isLocked && (
            <button
              onClick={handleUnlock}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Period</span>
            </button>
          )}

          {snapshot && (
            <>
              <button
                onClick={() => setIsSnapshotModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Snapshot</span>
              </button>

              {versionDiff && (
                <button
                  onClick={() => setIsDiffModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Version Diff</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Figures Bar (As-Closed vs Current Status - Requirement 65) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              {isClosed ? "Authoritative Frozen Closing Figures" : "Live Preliminary Period Figures"}
            </span>
            {isClosed && (
              <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Preserved as of Close
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Accounting Basis: <strong className="text-white">{checklist.preliminaryFigures.accountingBasis}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Opening Balance</div>
            <div className="font-bold text-slate-200 font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.openingBalance : checklist.preliminaryFigures.openingBalance}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Recognized Income</div>
            <div className="font-bold text-emerald-400 font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.totalIncome : checklist.preliminaryFigures.totalIncome}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Incurred Expenses</div>
            <div className="font-bold text-rose-400 font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.totalExpenses : checklist.preliminaryFigures.totalExpenses}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Result</div>
            <div className="font-bold text-white font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.netResult : checklist.preliminaryFigures.netResult}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Receivables</div>
            <div className="font-bold text-amber-400 font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.totalReceivables : checklist.preliminaryFigures.receivablesOutstanding}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Closing Cash</div>
            <div className="font-bold text-indigo-400 font-mono mt-0.5">
              {isClosed && snapshot ? snapshot.summary.closingBalance : checklist.preliminaryFigures.closingCashPosition}
            </div>
          </div>
        </div>
      </div>

      {/* Official Closed-Period Reports Bar (Requirement 44 & 45) */}
      {isClosed && snapshot && (
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">Official Month-End Closed Reports</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Authoritative Excel Workbook and PDF Dossier stamped with Version {snapshot.version} and closed status.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshot.reports.pdfReportId ? (
              <a
                href={`/api/exports/${snapshot.reports.pdfReportId}/download`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Final PDF</span>
              </a>
            ) : (
              <span className="text-xs text-slate-500 italic">PDF Pending</span>
            )}

            {snapshot.reports.excelReportId ? (
              <a
                href={`/api/exports/${snapshot.reports.excelReportId}/download`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Final Excel</span>
              </a>
            ) : (
              <span className="text-xs text-slate-500 italic">Excel Pending</span>
            )}

            <button
              onClick={handleRegenerateReports}
              disabled={isActionLoading}
              title="Regenerate missing reports strictly from snapshot data"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Main Checklist View */}
      <PreCloseChecklistView
        checklist={checklist}
        onRefresh={refreshChecklist}
        isRefreshing={isRefreshing}
      />

      {/* Modals */}
      <CloseMonthModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        year={year}
        month={month}
        periodLabel={checklist.periodLabel}
        preliminaryFigures={{
          totalIncome: checklist.preliminaryFigures.totalIncome,
          totalExpenses: checklist.preliminaryFigures.totalExpenses,
          netResult: checklist.preliminaryFigures.netResult,
          closingCashPosition: checklist.preliminaryFigures.closingCashPosition,
          receivablesOutstanding: checklist.preliminaryFigures.receivablesOutstanding,
          payablesOutstanding: checklist.preliminaryFigures.payablesOutstanding,
        }}
        dataChangeToken={checklist.dataChangeToken}
        onSuccess={async () => {
          await refreshChecklist();
        }}
      />

      <ReopenMonthModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        year={year}
        month={month}
        periodLabel={checklist.periodLabel}
        isLocked={isLocked}
        onSuccess={async () => {
          await refreshChecklist();
        }}
      />

      <SnapshotViewerModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        snapshot={snapshot}
      />

      <VersionDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        diff={versionDiff}
      />
    </div>
  );
}
