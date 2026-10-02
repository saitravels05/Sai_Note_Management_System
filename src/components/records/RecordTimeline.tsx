import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format, isToday, isYesterday } from "date-fns";
import { type SerializedRecord } from "./RecordCard";

import { TransactionType } from "@prisma/client";

interface RecordTimelineProps {
  records: SerializedRecord[];
}

export function RecordTimeline({ records }: RecordTimelineProps) {
  // Group records by day
  const grouped = records.reduce<Record<string, SerializedRecord[]>>((acc, record) => {
    const d = new Date(record.transactionDate);
    let key = format(d, "yyyy-MM-dd");
    if (isToday(d)) key = "TODAY";
    else if (isYesterday(d)) key = "YESTERDAY";
    else key = format(d, "EEEE, dd MMMM yyyy");

    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return (
    <div className="space-y-8 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
      {Object.entries(grouped).map(([dayLabel, dayRecords]) => (
        <div key={dayLabel} className="space-y-3 relative">
          {/* Day Header Marker */}
          <div className="flex items-center gap-2 -ml-6">
            <div className="w-5 h-5 rounded-full bg-orange-500 border-4 border-[#0b0f19] shadow-md shadow-orange-500/20 shrink-0" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              {dayLabel}
            </span>
            <span className="text-[11px] text-slate-500">
              ({dayRecords.length} {dayRecords.length === 1 ? "entry" : "entries"})
            </span>
          </div>

          {/* Records within the day */}
          <div className="space-y-2.5 pt-1">
            {dayRecords.map((r) => {
              const isIncome =
                r.transactionType === TransactionType.INCOME ||
                r.transactionType === TransactionType.RECEIVABLE ||
                r.transactionType === TransactionType.PAYMENT_IN;

              return (
                <Link
                  key={r.id}
                  href={`/records/${r.id}`}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e1422]/90 hover:bg-slate-800/60 border border-slate-800 transition-all text-xs group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`p-1.5 rounded-lg border text-[10px] font-bold uppercase shrink-0 ${
                        isIncome
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}
                    >
                      {r.transactionType.replace("_", " ")}
                    </span>

                    <div className="min-w-0">
                      <div className="font-semibold text-white group-hover:text-orange-300 transition-colors truncate">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {r.customerName || r.supplierName || r.categoryName} • #{r.transactionNumber}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-bold font-mono text-sm shrink-0 ml-4 ${
                      isIncome ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isIncome ? "+" : "-"} {formatINR(parseFloat(r.totalAmount || "0"))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
