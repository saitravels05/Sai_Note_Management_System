"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { type PeriodType } from "@/server/services/analytics.service";

interface FinancialPeriodSelectorProps {
  currentPeriod: PeriodType;
  startDate?: string;
  endDate?: string;
}

const PRESET_OPTIONS: { id: PeriodType; label: string; group: string }[] = [
  { id: "today", label: "Today", group: "Daily" },
  { id: "yesterday", label: "Yesterday", group: "Daily" },
  { id: "this-week", label: "This Week", group: "Weekly" },
  { id: "last-week", label: "Last Week", group: "Weekly" },
  { id: "this-month", label: "This Month", group: "Monthly" },
  { id: "last-month", label: "Last Month", group: "Monthly" },
  { id: "this-quarter", label: "This Quarter", group: "Quarterly" },
  { id: "last-quarter", label: "Last Quarter", group: "Quarterly" },
  { id: "this-year", label: "This Year", group: "Yearly" },
  { id: "last-year", label: "Last Year", group: "Yearly" },
  { id: "custom", label: "Custom Date Range", group: "Custom" },
];

export function FinancialPeriodSelector({
  currentPeriod,
  startDate,
  endDate,
}: FinancialPeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || "");
  const [customEnd, setCustomEnd] = useState(endDate || "");

  const handleSelectPeriod = (periodId: PeriodType) => {
    setIsOpen(false);
    if (periodId === "custom") {
      setShowCustomModal(true);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("period", periodId);
    params.delete("startDate");
    params.delete("endDate");

    router.push(`${pathname}?${params.toString()}`);
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    setShowCustomModal(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    params.set("startDate", customStart);
    params.set("endDate", customEnd);

    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedLabel =
    PRESET_OPTIONS.find((p) => p.id === currentPeriod)?.label || "This Month";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-all shadow-sm"
        aria-label="Select reporting period"
      >
        <Calendar className="w-3.5 h-3.5 text-orange-400" />
        <span>{selectedLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-card border border-slate-700 shadow-2xl bg-slate-950/95 backdrop-blur-xl z-50 p-2 space-y-1 animate-scale-in">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reporting Period
          </div>

          <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = currentPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectPeriod(opt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? "bg-orange-500/20 text-orange-400 font-bold"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-orange-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Date Range Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl glass-card border border-slate-700 bg-slate-950 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                Select Custom Date Range
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">From Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">To Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomRange}
                disabled={!customStart || !customEnd}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-colors"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
