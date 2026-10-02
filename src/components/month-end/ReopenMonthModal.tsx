"use client";

import { useState } from "react";
import {
  Unlock,
  AlertTriangle,
  Loader2,
  X,
  RotateCcw,
} from "lucide-react";
import {
  reopenFinancialPeriodAction,
} from "@/server/actions/month-end.actions";
import {
  REOPEN_REASON_CATEGORIES,
  type ReopenReasonCategory,
} from "@/types/month-end";

interface ReopenMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  periodLabel: string;
  isLocked?: boolean;
  onSuccess: (result: unknown) => void;
}

export function ReopenMonthModal({
  isOpen,
  onClose,
  year,
  month,
  periodLabel,
  isLocked = false,
  onSuccess,
}: ReopenMonthModalProps) {
  const [reasonCategory, setReasonCategory] = useState<ReopenReasonCategory>("Late Supplier Invoice");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFormValid = explanation.trim().length >= 5;

  const handleReopen = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await reopenFinancialPeriodAction({
        year,
        month,
        reasonCategory,
        explanation,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to reopen financial period.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error reopening period.");
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
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Reopen {periodLabel}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Allow authorized ledger corrections for this closed accounting period.
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
            <p className="font-semibold text-amber-300">Audited Snapshot Protection</p>
            <p className="text-amber-200/90 leading-relaxed text-[11px]">
              Reopening will preserve the current closing snapshot in the historical audit chain.
              When reclosed, a new version (Version 2+) will be generated alongside full side-by-side reconciliation.
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            <strong>LOCKED Period Notice:</strong> Reopening this locked period requires elevated Owner or Admin authorization.
          </div>
        )}

        {/* Reason Category Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Reopen Justification Category <span className="text-rose-400">*</span>
          </label>
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value as ReopenReasonCategory)}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
          >
            {REOPEN_REASON_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Audit Explanation & Required Action <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain why this period requires reopening, which specific entries are being corrected, and the expected impact..."
            rows={3}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <span className="text-[10px] text-slate-500">Minimum 5 characters required for audit compliance.</span>
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
            onClick={handleReopen}
            disabled={!isFormValid || isSubmitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
              isFormValid && !isSubmitting
                ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Reopening Period...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Authorize & Reopen Period</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
