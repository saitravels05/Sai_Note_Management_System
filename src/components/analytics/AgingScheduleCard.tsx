"use client";

import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { Clock, ArrowUpRight } from "lucide-react";
import { type AgingAnalysisResult } from "@/server/services/accounting.service";

interface AgingScheduleCardProps {
  title: string;
  type: "RECEIVABLE" | "PAYABLE";
  aging: AgingAnalysisResult;
}

function toNumeric(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === "object") {
    if ("toNumber" in val && typeof (val as { toNumber: unknown }).toNumber === "function") {
      try {
        return (val as { toNumber: () => number }).toNumber();
      } catch {
        // fallback
      }
    }
    if ("toDecimalString" in val && typeof (val as { toDecimalString: unknown }).toDecimalString === "function") {
      try {
        return parseFloat((val as { toDecimalString: () => string }).toDecimalString()) || 0;
      } catch {
        // fallback
      }
    }
    if ("value" in val) {
      return toNumeric((val as { value: unknown }).value);
    }
    if ("amount" in val) {
      return toNumeric((val as { amount: unknown }).amount);
    }
  }
  return 0;
}

function toDecimalStr(val: unknown): string {
  if (val && typeof val === "object" && "toDecimalString" in val && typeof (val as { toDecimalString: unknown }).toDecimalString === "function") {
    try {
      return (val as { toDecimalString: () => string }).toDecimalString();
    } catch {
      // fallback
    }
  }
  return toNumeric(val).toFixed(2);
}

export function AgingScheduleCard({ title, type, aging }: AgingScheduleCardProps) {
  const isReceivable = type === "RECEIVABLE";
  const targetHref = isReceivable ? "/receivables" : "/payables";

  const totalOutstanding = toNumeric(aging?.total);

  const buckets = [
    {
      label: "Current (Not Due)",
      amountString: toDecimalStr(aging?.current?.amount),
      amountNum: toNumeric(aging?.current?.amount),
      count: aging?.current?.count ?? 0,
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
    },
    {
      label: "1–30 Days Overdue",
      amountString: toDecimalStr(aging?.days1To30?.amount),
      amountNum: toNumeric(aging?.days1To30?.amount),
      count: aging?.days1To30?.count ?? 0,
      color: "bg-amber-500",
      textColor: "text-amber-400",
    },
    {
      label: "31–60 Days Overdue",
      amountString: toDecimalStr(aging?.days31To60?.amount),
      amountNum: toNumeric(aging?.days31To60?.amount),
      count: aging?.days31To60?.count ?? 0,
      color: "bg-orange-500",
      textColor: "text-orange-400",
    },
    {
      label: "61–90 Days Overdue",
      amountString: toDecimalStr(aging?.days61To90?.amount),
      amountNum: toNumeric(aging?.days61To90?.amount),
      count: aging?.days61To90?.count ?? 0,
      color: "bg-rose-500",
      textColor: "text-rose-400",
    },
    {
      label: "90+ Days (Critical)",
      amountString: toDecimalStr(aging?.days90Plus?.amount),
      amountNum: toNumeric(aging?.days90Plus?.amount),
      count: aging?.days90Plus?.count ?? 0,
      color: "bg-red-600",
      textColor: "text-red-400",
    },
  ];

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isReceivable ? "text-orange-400" : "text-purple-400"}`} />
            {title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            5-tier outstanding debt maturity schedule
          </p>
        </div>

        <Link
          href={targetHref}
          className="flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          <span>Manage</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Progress Multi-Bar */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
          {buckets.map((b, i) => {
            const pct = totalOutstanding > 0 ? (b.amountNum / totalOutstanding) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={i}
                className={`${b.color} transition-all duration-300`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ₹${formatINR(b.amountString)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Bucket Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
        {buckets.map((b, idx) => {
          const pct = totalOutstanding > 0 ? (b.amountNum / totalOutstanding) * 100 : 0;
          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${b.color}`} />
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  {b.label}
                </span>
              </div>
              <div className="text-sm font-black text-white">
                ₹{formatINR(b.amountString)}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{b.count} items</span>
                <span className={b.textColor}>{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
