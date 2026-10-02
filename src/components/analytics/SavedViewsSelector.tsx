"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, DollarSign, AlertCircle, FileSpreadsheet } from "lucide-react";

export type DashboardViewType = "OVERVIEW" | "CASH_FLOW" | "DUES_RECEIVABLES" | "EXPENSE_AUDIT";

interface SavedViewsSelectorProps {
  currentView: DashboardViewType;
}

const VIEWS: { id: DashboardViewType; label: string; icon: typeof LayoutGrid }[] = [
  { id: "OVERVIEW", label: "Executive Overview", icon: LayoutGrid },
  { id: "CASH_FLOW", label: "Cash & Liquidity", icon: DollarSign },
  { id: "DUES_RECEIVABLES", label: "Receivables & Dues", icon: AlertCircle },
  { id: "EXPENSE_AUDIT", label: "Expense Audit", icon: FileSpreadsheet },
];

export function SavedViewsSelector({ currentView }: SavedViewsSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelectView = (viewId: DashboardViewType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", viewId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs overflow-x-auto custom-scrollbar">
      {VIEWS.map((v) => {
        const isSelected = currentView === v.id;
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            onClick={() => handleSelectView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              isSelected
                ? "bg-orange-600 text-white shadow-sm shadow-orange-600/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
