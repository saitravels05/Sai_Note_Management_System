import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck,
  FileText,
  Sliders,
  Calendar,
  User,
  Building,
  Tag,
  Hash,
  ChevronRight,
} from "lucide-react";
import { TransactionType, PaymentStatus, TransactionStatus } from "@prisma/client";

export interface SerializedRecord {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  transactionType: TransactionType;
  title: string;
  description: string | null;
  referenceNumber: string | null;
  amount: string;
  totalAmount: string;
  paymentStatus: PaymentStatus;
  status: TransactionStatus;
  dueDate: string | null;
  categoryName: string;
  customerName: string | null;
  supplierName: string | null;
  tags: string[];
}

interface RecordCardProps {
  record: SerializedRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const getTypeMeta = () => {
    switch (record.transactionType) {
      case TransactionType.INCOME:
        return {
          label: "Income",
          icon: TrendingUp,
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          amountColor: "text-emerald-400",
          prefix: "+",
        };
      case TransactionType.EXPENSE:
        return {
          label: "Expense",
          icon: TrendingDown,
          badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
          amountColor: "text-red-400",
          prefix: "-",
        };
      case TransactionType.PAYMENT_IN:
        return {
          label: "Payment In",
          icon: ArrowDownLeft,
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          amountColor: "text-blue-400",
          prefix: "+",
        };
      case TransactionType.PAYMENT_OUT:
        return {
          label: "Payment Out",
          icon: ArrowUpRight,
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          amountColor: "text-amber-400",
          prefix: "-",
        };
      case TransactionType.RECEIVABLE:
        return {
          label: "Receivable",
          icon: FileCheck,
          badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
          amountColor: "text-cyan-400",
          prefix: "+",
        };
      case TransactionType.PAYABLE:
        return {
          label: "Payable",
          icon: FileText,
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          amountColor: "text-purple-400",
          prefix: "-",
        };
      case TransactionType.ADJUSTMENT:
      default:
        return {
          label: "Adjustment",
          icon: Sliders,
          badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          amountColor: "text-rose-400",
          prefix: "",
        };
    }
  };

  const getStatusBadge = () => {
    if (record.status === TransactionStatus.DRAFT) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          DRAFT
        </span>
      );
    }
    if (record.status === TransactionStatus.VOID) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          VOIDED
        </span>
      );
    }
    return null;
  };

  const getPaymentStatusBadge = () => {
    switch (record.paymentStatus) {
      case PaymentStatus.PAID:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Paid
          </span>
        );
      case PaymentStatus.PARTIALLY_PAID:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Partially Paid
          </span>
        );
      case PaymentStatus.UNPAID:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Unpaid
          </span>
        );
      default:
        return null;
    }
  };

  const typeMeta = getTypeMeta();
  const Icon = typeMeta.icon;
  const numAmount = parseFloat(record.totalAmount || record.amount || "0");
  const formattedINR = formatINR(numAmount);
  const formattedDate = format(new Date(record.transactionDate), "dd MMM yyyy");

  return (
    <Link
      href={`/records/${record.id}`}
      className="group block p-4 sm:p-5 rounded-2xl bg-[#0e1422]/90 hover:bg-slate-800/40 border border-slate-800/90 hover:border-orange-500/40 shadow-xl transition-all relative overflow-hidden"
    >
      {/* Top Row: Type Badge, Transaction # & Status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${typeMeta.badgeColor}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{typeMeta.label}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-600" />
            <span>{record.transactionNumber}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {getStatusBadge()}
          {getPaymentStatusBadge()}
        </div>
      </div>

      {/* Middle Row: Title & Amount */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors truncate flex-1">
          {record.title}
        </h3>
        <div className={`text-base font-bold tracking-tight font-mono shrink-0 ${typeMeta.amountColor}`}>
          {typeMeta.prefix} {formattedINR}
        </div>
      </div>

      {/* Metadata Row: Date, Party, Category */}
      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-slate-400 mb-3">
        <div className="flex items-center gap-1 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{formattedDate}</span>
        </div>

        {record.customerName && (
          <div className="flex items-center gap-1 text-slate-300 truncate max-w-[160px]">
            <User className="w-3.5 h-3.5 text-orange-400/80 shrink-0" />
            <span className="truncate">{record.customerName}</span>
          </div>
        )}

        {record.supplierName && (
          <div className="flex items-center gap-1 text-slate-300 truncate max-w-[160px]">
            <Building className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            <span className="truncate">{record.supplierName}</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-slate-400 truncate max-w-[140px]">
          <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{record.categoryName}</span>
        </div>
      </div>

      {/* Tags and Reference */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-1 truncate">
          {record.referenceNumber && (
            <span className="font-mono text-slate-400 mr-1.5">
              Ref: {record.referenceNumber}
            </span>
          )}
          {record.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400"
            >
              #{tag}
            </span>
          ))}
          {record.tags.length > 3 && (
            <span className="text-slate-500">+{record.tags.length - 3}</span>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
      </div>
    </Link>
  );
}
