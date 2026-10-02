"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { DollarSign, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { type TrendDataPoint } from "@/server/services/analytics.service";

interface CashFlowTrendChartProps {
  data: TrendDataPoint[];
  periodLabel: string;
}

export function CashFlowTrendChart({ data, periodLabel }: CashFlowTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl glass-card border border-slate-800 flex flex-col items-center justify-center min-h-[300px] text-center space-y-2">
        <DollarSign className="w-8 h-8 text-slate-600" />
        <p className="text-sm font-semibold text-slate-300">No Cash Flow Movements</p>
        <p className="text-xs text-slate-500">
          No cash inflows or disbursements recorded for {periodLabel}.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.moneyIn, d.moneyOut)),
    1000
  );

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Cash Flow Trend (Money In vs Money Out)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical liquidity flow (strictly separated from recognized accounting profit)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
            <span className="text-slate-300 font-medium">Money Received</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span className="text-slate-300 font-medium">Money Paid</span>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Strip */}
      {activePoint && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-white">
            Period: <span className="text-blue-400">{activePoint.label}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-blue-400 font-bold flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Inflow: ₹{formatINR(activePoint.moneyIn)}
            </div>
            <div className="text-amber-400 font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Outflow: ₹{formatINR(activePoint.moneyOut)}
            </div>
            <div
              className={`font-black ${
                activePoint.moneyIn - activePoint.moneyOut >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              Net Movement: ₹{formatINR(activePoint.moneyIn - activePoint.moneyOut)}
            </div>
          </div>
        </div>
      )}

      {/* Visualizer */}
      <div className="relative pt-6 pb-2">
        <div className="h-56 flex items-end gap-2 sm:gap-3 overflow-x-auto custom-scrollbar px-1">
          {data.map((point, idx) => {
            const inHeight = (point.moneyIn / maxVal) * 100;
            const outHeight = (point.moneyOut / maxVal) * 100;
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
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div
                    title={`Money In on ${point.label}: ₹${formatINR(point.moneyIn)}`}
                    className="w-1/2 bg-blue-500/80 hover:bg-blue-400 rounded-t transition-all group-hover:shadow-lg group-hover:shadow-blue-500/30"
                    style={{ height: `${Math.max(inHeight, 3)}%` }}
                  />
                  <div
                    title={`Money Paid on ${point.label}: ₹${formatINR(point.moneyOut)}`}
                    className="w-1/2 bg-amber-500/80 hover:bg-amber-400 rounded-t transition-all group-hover:shadow-lg group-hover:shadow-amber-500/30"
                    style={{ height: `${Math.max(outHeight, 3)}%` }}
                  />
                </div>

                <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                  {point.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <span>Payment collections and disbursement flows</span>
        <Link
          href="/receivables"
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold"
        >
          <span>Manage Payments</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
