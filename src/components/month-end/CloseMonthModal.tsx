"use client";

import { useState } from "react";
import {
  Lock,
  AlertTriangle,
  Loader2,
  X,
  FileCheck2,
} from "lucide-react";
import { closeFinancialPeriodAction } from "@/server/actions/month-end.actions";

interface CloseMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  periodLabel: string;
  preliminaryFigures: {
    totalIncome: string;
    totalExpenses: string;
    netResult: string;
    closingCashPosition: string;
    receivablesOutstanding: string;
    payablesOutstanding: string;
  };
  dataChangeToken?: string;
  onSuccess: (result: unknown) => void;
}

export function CloseMonthModal({
  isOpen,
  onClose,
  year,
  month,
  periodLabel,
  preliminaryFigures,
  dataChangeToken,
  onSuccess,
}: CloseMonthModalProps) {
  const [closingNotes, setClosingNotes] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const requiredKeyword = `CLOSE ${periodLabel.toUpperCase()}`;
  const isKeywordMatched = confirmInput.trim().toUpperCase() === requiredKeyword;

  const handleClose = async () => {
    if (!isKeywordMatched) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await closeFinancialPeriodAction({
        year,
        month,
        closingNotes,
        dataChangeToken,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to close financial period.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error closing period.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Close {periodLabel}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Freeze accounting ledger and generate authoritative month-end closing snapshot.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Callout */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Period Lock Warning</p>
            <p className="text-amber-200/90 leading-relaxed text-[11px]">
              Closing this period will strictly prohibit new posted transactions, edits, voiding,
              and payment allocations dated in this period.
            </p>
          </div>
        </div>

        {/* Figures Summary */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Income</div>
            <div className="font-bold text-emerald-400 font-mono mt-0.5">
              {preliminaryFigures.totalIncome}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Expenses</div>
            <div className="font-bold text-rose-400 font-mono mt-0.5">
              {preliminaryFigures.totalExpenses}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Result</div>
            <div className="font-bold text-white font-mono mt-0.5">
              {preliminaryFigures.netResult}
            </div>
          </div>
        </div>

        {/* Closing Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Internal Closing Notes & Disclosures (Optional)
          </label>
          <textarea
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            placeholder="Document timing differences, unapplied advance explanations, or accountant sign-off notes..."
            rows={2}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        {/* Explicit Confirmation Input (Requirement 37) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Type <span className="font-mono text-rose-400 font-bold select-all">{requiredKeyword}</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={requiredKeyword}
            className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={!isKeywordMatched || isSubmitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
              isKeywordMatched && !isSubmitting
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Closing Period & Freezing Books...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4" />
                <span>Confirm & Close Period</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
