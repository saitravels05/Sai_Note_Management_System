import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format } from "date-fns";
import { type SerializedRecord } from "./RecordCard";
import { TransactionType, TransactionStatus } from "@prisma/client";

interface RecordTableProps {
  records: SerializedRecord[];
}

export function RecordTable({ records }: RecordTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0e1422] shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
          <tr>
            <th className="px-4 py-3">Txn #</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Party</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-200">
          {records.map((r) => {
            const isIncome =
              r.transactionType === TransactionType.INCOME ||
              r.transactionType === TransactionType.RECEIVABLE ||
              r.transactionType === TransactionType.PAYMENT_IN;

            return (
              <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-400">
                  <Link href={`/records/${r.id}`} className="hover:text-orange-400 hover:underline">
                    {r.transactionNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {format(new Date(r.transactionDate), "dd-MM-yyyy")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      isIncome
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                    }`}
                  >
                    {r.transactionType.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate">
                  <Link href={`/records/${r.id}`} className="hover:text-orange-300">
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300 max-w-[140px] truncate">
                  {r.customerName || r.supplierName || "—"}
                </td>
                <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">
                  {r.categoryName}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] capitalize text-slate-400">
                    {r.paymentStatus.toLowerCase().replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.status === TransactionStatus.DRAFT ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                      DRAFT
                    </span>
                  ) : r.status === TransactionStatus.VOID ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold">
                      VOID
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                      POSTED
                    </span>
                  )}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-bold ${
                    isIncome ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isIncome ? "+" : "-"} {formatINR(parseFloat(r.totalAmount || "0"))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
