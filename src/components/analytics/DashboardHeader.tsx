"use client";

import Link from "next/link";
import { PlusCircle, ArrowDownLeft, ArrowUpRight, FileText, BarChart3, RefreshCw } from "lucide-react";
import { FinancialPeriodSelector } from "./FinancialPeriodSelector";
import { SavedViewsSelector, type DashboardViewType } from "./SavedViewsSelector";
import { type PeriodType } from "@/server/services/analytics.service";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuickExportModal } from "@/components/exports/QuickExportModal";

interface DashboardHeaderProps {
  businessName: string;
  currentPeriod: PeriodType;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  currentView: DashboardViewType;
  userPermissions: string[];
  userRoles: string[];
}

export function DashboardHeader({
  businessName,
  currentPeriod,
  periodLabel,
  startDate,
  endDate,
  currentView,
  userPermissions,
  userRoles,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOwner = userRoles.includes("OWNER");
  const canCreateRecords = isOwner || userPermissions.includes("records.create") || userPermissions.includes("*");
  const canCreatePayments = isOwner || userPermissions.includes("payments.create") || userPermissions.includes("*");
  const canCreateNotes = isOwner || userPermissions.includes("notes.create") || userPermissions.includes("*");
  const canViewReports = isOwner || userPermissions.includes("reports.view") || userPermissions.includes("*");

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-4">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
              {businessName}
            </span>
            <span className="text-xs text-slate-400">• Financial Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time accounting figures for <span className="text-slate-200 font-semibold">{periodLabel}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh dashboard data"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-400" : ""}`} />
          </button>

          {canCreateRecords && (
            <Link
              href="/quick-entry"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-600/20 transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Record</span>
            </Link>
          )}

          {canCreatePayments && (
            <>
              <Link
                href="/receivables"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 transition-all"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Receive Payment</span>
              </Link>

              <Link
                href="/payables"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 transition-all"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                <span>Make Payment</span>
              </Link>
            </>
          )}

          {canCreateNotes && (
            <Link
              href="/notes"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes</span>
            </Link>
          )}

          {canViewReports && (
            <>
              <QuickExportModal
                buttonText="Export Dashboard"
                defaultExportType="MONTHLY_WORKBOOK"
                period={currentPeriod}
                startDate={startDate}
                endDate={endDate}
                buttonClassName="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 transition-all"
              />

              <Link
                href="/reports"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Reports</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Subheader: Period Selector & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <SavedViewsSelector currentView={currentView} />
        <FinancialPeriodSelector
          currentPeriod={currentPeriod}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}
