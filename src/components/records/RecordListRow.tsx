import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format } from "date-fns";
import { type SerializedRecord } from "./RecordCard";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck,
  FileText,
  Sliders,
} from "lucide-react";
import { TransactionType, TransactionStatus } from "@prisma/client";

interface RecordListRowProps {
  record: SerializedRecord;
}

export function RecordListRow({ record }: RecordListRowProps) {
  const getTypeMeta = () => {
    switch (record.transactionType) {
      case TransactionType.INCOME:
        return { label: "Income", icon: TrendingUp, color: "text-emerald-400" };
      case TransactionType.EXPENSE:
        return { label: "Expense", icon: TrendingDown, color: "text-red-400" };
      case TransactionType.PAYMENT_IN:
        return { label: "Payment In", icon: ArrowDownLeft, color: "text-blue-400" };
      case TransactionType.PAYMENT_OUT:
        return { label: "Payment Out", icon: ArrowUpRight, color: "text-amber-400" };
      case TransactionType.RECEIVABLE:
        return { label: "Receivable", icon: FileCheck, color: "text-cyan-400" };
      case TransactionType.PAYABLE:
        return { label: "Payable", icon: FileText, color: "text-purple-400" };
      default:
        return { label: "Adjustment", icon: Sliders, color: "text-rose-400" };
    }
  };

  const meta = getTypeMeta();
  const Icon = meta.icon;
  const numAmount = parseFloat(record.totalAmount || "0");
  const formattedINR = formatINR(numAmount);
  const formattedDate = format(new Date(record.transactionDate), "dd MMM yyyy");

  return (
    <Link
      href={`/records/${record.id}`}
      className="group flex items-center justify-between p-3.5 sm:px-5 sm:py-3.5 rounded-xl bg-[#0e1422]/90 hover:bg-slate-800/50 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0 ${meta.color}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white group-hover:text-orange-300 transition-colors truncate">
              {record.title}
            </span>
            {record.status === TransactionStatus.DRAFT && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
                DRAFT
              </span>
            )}
            {record.status === TransactionStatus.VOID && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-semibold">
                VOID
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
            <span className="font-mono text-slate-500">{record.transactionNumber}</span>
            <span>•</span>
            <span>{record.customerName || record.supplierName || record.categoryName}</span>
            <span>•</span>
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 ml-4">
        <div className={`font-bold font-mono text-sm ${meta.color}`}>
          {formattedINR}
        </div>
        <div className="text-[10px] text-slate-500 capitalize mt-0.5">
          {record.paymentStatus.toLowerCase().replace("_", " ")}
        </div>
      </div>
    </Link>
  );
}
