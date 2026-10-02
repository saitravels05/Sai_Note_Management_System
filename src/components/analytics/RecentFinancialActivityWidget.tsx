"use client";

import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { formatBusinessDate } from "@/lib/date";
import { TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, ArrowRight } from "lucide-react";
import { TransactionType } from "@prisma/client";

export interface SerializedActivityItem {
  id: string;
  number: string;
  type: TransactionType;
  date: string;
  amount: string;
  partyName: string | null;
  categoryName: string | null;
  status: string;
  paymentStatus?: string;
}

interface RecentFinancialActivityWidgetProps {
  records: SerializedActivityItem[];
}

export function RecentFinancialActivityWidget({ records }: RecentFinancialActivityWidgetProps) {
  const getTypeBadge = (type: TransactionType) => {
    switch (type) {
      case TransactionType.INCOME:
        return {
          icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
          label: "Income",
          class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case TransactionType.EXPENSE:
        return {
          icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
          label: "Expense",
          class: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case TransactionType.RECEIVABLE:
        return {
          icon: <ArrowDownLeft className="w-3.5 h-3.5 text-orange-400" />,
          label: "Receivable",
          class: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        };
      case TransactionType.PAYABLE:
        return {
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />,
          label: "Payable",
          class: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        };
      default:
        return {
          icon: <TrendingUp className="w-3.5 h-3.5 text-slate-400" />,
          label: type,
          class: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        };
    }
  };

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Recent Financial Activity</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Latest posted ledger transactions and vouchers
          </p>
        </div>

        <Link
          href="/records"
          className="flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          <span>All Records</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No financial records posted yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {records.map((r) => {
            const badge = getTypeBadge(r.type);
            const isPositive =
              r.type === TransactionType.INCOME || r.type === TransactionType.RECEIVABLE;

            return (
              <Link
                key={r.id}
                href={`/records/${r.id}`}
                className="group p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${badge.class}`}>
                    {badge.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-white group-hover:text-orange-400 transition-colors">
                        {r.number}
                      </span>
                      {r.partyName && (
                        <span className="text-slate-300 font-medium">
                          • {r.partyName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatBusinessDate(r.date)} {r.categoryName ? `• ${r.categoryName}` : ""}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-black ${
                      isPositive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isPositive ? "+" : "-"}₹{formatINR(r.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {r.paymentStatus || r.status}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
