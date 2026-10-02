"use client";

import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { type MetricComparison } from "@/server/services/analytics.service";

interface PrimaryKpiGridProps {
  kpi: {
    income: MetricComparison;
    expenses: MetricComparison;
    netResult: MetricComparison;
    moneyReceived: MetricComparison;
    moneyPaid: MetricComparison;
    netCashFlow: MetricComparison;
    totalReceivables: string;
    totalPayables: string;
    cashBalance: string;
    bankBalance: string;
    upiBalance: string;
    totalLiquidity: string;
  };
  prevPeriodLabel: string;
}

export function PrimaryKpiGrid({ kpi, prevPeriodLabel }: PrimaryKpiGridProps) {
  const renderTrendBadge = (comp: MetricComparison) => {
    if (comp.percentageChange === null) {
      return (
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
          New Baseline
        </span>
      );
    }

    const isFlat = comp.trend === "FLAT" || comp.percentageChange === 0;
    if (isFlat) {
      return (
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
          0.0%
        </span>
      );
    }

    const isUp = comp.trend === "UP";
    const colorClass = comp.isPositiveForBusiness
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : "text-rose-400 bg-rose-500/10 border-rose-500/20";

    const Icon = isUp ? TrendingUp : TrendingDown;
    const sign = isUp ? "+" : "";

    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${colorClass}`}
      >
        <Icon className="w-3 h-3" />
        {sign}
        {comp.percentageChange}%
      </span>
    );
  };

  const netNum = parseFloat(kpi.netResult.current) || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Recognized Income */}
      <Link
        href="/records?type=INCOME"
        className="group p-5 rounded-2xl glass-card border border-slate-800 hover:border-emerald-500/30 transition-all hover:shadow-lg hover:shadow-emerald-950/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recognized Income
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors">
            ₹{formatINR(kpi.income.current)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {renderTrendBadge(kpi.income)}
            <span className="text-[11px] text-slate-400 truncate">
              vs {prevPeriodLabel}
            </span>
          </div>
        </div>
      </Link>

      {/* 2. Recognized Expenses */}
      <Link
        href="/records?type=EXPENSE"
        className="group p-5 rounded-2xl glass-card border border-slate-800 hover:border-rose-500/30 transition-all hover:shadow-lg hover:shadow-rose-950/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recognized Expenses
          </span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-white group-hover:text-rose-400 transition-colors">
            ₹{formatINR(kpi.expenses.current)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {renderTrendBadge(kpi.expenses)}
            <span className="text-[11px] text-slate-400 truncate">
              vs {prevPeriodLabel}
            </span>
          </div>
        </div>
      </Link>

      {/* 3. Net Result (Profit / Deficit) */}
      <div
        className={`p-5 rounded-2xl glass-card border transition-all ${
          netNum >= 0
            ? "border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40"
            : "border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Net Result (Profit)
          </span>
          <div
            className={`p-2 rounded-xl ${
              netNum >= 0
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div
            className={`text-2xl font-black ${
              netNum >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            ₹{formatINR(kpi.netResult.current)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {renderTrendBadge(kpi.netResult)}
            <span className="text-[11px] text-slate-400 truncate">
              Income - Expenses
            </span>
          </div>
        </div>
      </div>

      {/* 4. Cash Liquidity Position */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Cash & Liquidity
          </span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-white">
            ₹{formatINR(kpi.totalLiquidity)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            <span>Cash: ₹{formatINR(kpi.cashBalance)}</span>
            <span>•</span>
            <span>Bank/UPI: ₹{formatINR(parseFloat(kpi.bankBalance) + parseFloat(kpi.upiBalance))}</span>
          </div>
        </div>
      </div>

      {/* 5. Actual Money Inflows */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Money Received (Inflows)
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-slate-200">
            ₹{formatINR(kpi.moneyReceived.current)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {renderTrendBadge(kpi.moneyReceived)}
            <span className="text-[11px] text-slate-400 truncate">
              Physical collections
            </span>
          </div>
        </div>
      </div>

      {/* 6. Actual Money Outflows */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Money Paid (Outflows)
          </span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-slate-200">
            ₹{formatINR(kpi.moneyPaid.current)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {renderTrendBadge(kpi.moneyPaid)}
            <span className="text-[11px] text-slate-400 truncate">
              Disbursements
            </span>
          </div>
        </div>
      </div>

      {/* 7. Receivables Outstanding */}
      <Link
        href="/receivables"
        className="group p-5 rounded-2xl glass-card border border-slate-800 hover:border-orange-500/30 transition-all hover:shadow-lg hover:shadow-orange-950/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Receivables (Unpaid)
          </span>
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors">
            ₹{formatINR(kpi.totalReceivables)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
            <span className="text-orange-400 font-semibold">Customer dues</span>
            <span>•</span>
            <span>View list →</span>
          </div>
        </div>
      </Link>

      {/* 8. Payables Outstanding */}
      <Link
        href="/payables"
        className="group p-5 rounded-2xl glass-card border border-slate-800 hover:border-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-950/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Payables (Pending)
          </span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-black text-white group-hover:text-purple-400 transition-colors">
            ₹{formatINR(kpi.totalPayables)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
            <span className="text-purple-400 font-semibold">Supplier dues</span>
            <span>•</span>
            <span>View list →</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
