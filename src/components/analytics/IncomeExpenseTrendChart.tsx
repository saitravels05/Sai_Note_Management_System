"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { BarChart3, TrendingUp, ArrowUpRight } from "lucide-react";
import { type TrendDataPoint } from "@/server/services/analytics.service";

interface IncomeExpenseTrendChartProps {
  data: TrendDataPoint[];
  periodLabel: string;
}

export function IncomeExpenseTrendChart({ data, periodLabel }: IncomeExpenseTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center min-h-[300px] text-center space-y-2">
        <BarChart3 className="w-8 h-8 text-slate-600" />
        <p className="text-sm font-semibold text-slate-300">No Financial Activity</p>
        <p className="text-xs text-slate-500">
          No income or expense records were found for {periodLabel}.
        </p>
      </div>
    );
  }

  // Find max value for proportional height scaling
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.income, d.expenses)),
    1000 // base floor to avoid div by zero
  );

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Income vs Expenses Trend
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Recognized financial performance over {periodLabel}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span className="text-slate-300 font-medium">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
            <span className="text-slate-300 font-medium">Expenses</span>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Strip on hover */}
      {activePoint && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-white">
            Period: <span className="text-orange-400">{activePoint.label}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-emerald-400 font-bold">
              Income: ₹{formatINR(activePoint.income)}
            </div>
            <div className="text-rose-400 font-bold">
              Expenses: ₹{formatINR(activePoint.expenses)}
            </div>
            <div
              className={`font-black ${
                activePoint.netResult >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              Net: ₹{formatINR(activePoint.netResult)}
            </div>
          </div>
        </div>
      )}

      {/* SVG Bar Visualizer */}
      <div className="relative pt-6 pb-2">
        <div className="h-56 flex items-end gap-2 sm:gap-3 overflow-x-auto custom-scrollbar px-1">
          {data.map((point, idx) => {
            const incHeight = (point.income / maxVal) * 100;
            const expHeight = (point.expenses / maxVal) * 100;
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={point.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex-1 min-w-[28px] max-w-[56px] h-full flex flex-col justify-end items-center group cursor-pointer transition-all ${
                  isHovered ? "opacity-100" : "opacity-85 hover:opacity-100"
                }`}
              >
                {/* Dual Bars */}
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  {/* Income Bar */}
                  <Link
                    href={`/records?type=INCOME&date=${point.date}`}
                    title={`Income on ${point.label}: ₹${formatINR(point.income)} (Click to view records)`}
                    className="w-1/2 bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all group-hover:shadow-lg group-hover:shadow-emerald-500/30"
                    style={{ height: `${Math.max(incHeight, 3)}%` }}
                  />

                  {/* Expense Bar */}
                  <Link
                    href={`/records?type=EXPENSE&date=${point.date}`}
                    title={`Expenses on ${point.label}: ₹${formatINR(point.expenses)} (Click to view records)`}
                    className="w-1/2 bg-rose-500/80 hover:bg-rose-400 rounded-t transition-all group-hover:shadow-lg group-hover:shadow-rose-500/30"
                    style={{ height: `${Math.max(expHeight, 3)}%` }}
                  />
                </div>

                {/* X-axis Label */}
                <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                  {point.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drill-down Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <span>Click any bar to drill down into filtered daily records</span>
        <Link
          href="/records"
          className="flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold"
        >
          <span>All Records</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
