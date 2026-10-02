"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format, isToday, differenceInDays } from "date-fns";
import {
  Search,
  Clock,
  AlertTriangle,
  ArrowDownLeft,
  ChevronRight,
  User,
  PlusCircle,
  BarChart3,
  Calendar,
} from "lucide-react";
import { PaymentStatus, PaymentDirection } from "@prisma/client";
import { ReceivePaymentModal } from "./ReceivePaymentModal";
import {
  type ReceivablesSummaryResult,
  type AgingAnalysisResult,
} from "@/server/services/accounting.service";

export interface SerializedReceivable {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  title: string;
  referenceNumber: string | null;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentStatus: PaymentStatus;
  dueDate: string | null;
  customerId: string | null;
  customerName: string | null;
  customerCode: string | null;
  categoryName: string;
}

interface ReceivablesWorkspaceProps {
  receivables: SerializedReceivable[];
  summary: ReceivablesSummaryResult;
  aging: AgingAnalysisResult;
  paymentMethods: { id: string; name: string; type: string }[];
}

export function ReceivablesWorkspace({
  receivables,
  summary,
  aging,
  paymentMethods,
}: ReceivablesWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedReceivable, setSelectedReceivable] = useState<SerializedReceivable | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const now = new Date();

  // Filter receivables
  const filtered = receivables.filter((r) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.title.toLowerCase().includes(q) ||
        r.transactionNumber.toLowerCase().includes(q) ||
        (r.referenceNumber && r.referenceNumber.toLowerCase().includes(q)) ||
        (r.customerName && r.customerName.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Status tab
    if (statusFilter === "UNPAID") return r.paymentStatus === PaymentStatus.UNPAID;
    if (statusFilter === "PARTIAL") return r.paymentStatus === PaymentStatus.PARTIALLY_PAID;
    if (statusFilter === "PAID") return r.paymentStatus === PaymentStatus.PAID;
    if (statusFilter === "OVERDUE") {
      if (parseFloat(r.outstandingAmount) <= 0 || !r.dueDate) return false;
      return new Date(r.dueDate) < now && !isToday(new Date(r.dueDate));
    }

    return true;
  });

  const handleOpenPayment = (r: SerializedReceivable) => {
    setSelectedReceivable(r);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                🧾
              </span>
              Accounts Receivable
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Money Owed to Business
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track customer invoices, collections, payment aging, and outstanding balances.
          </p>
        </div>

        <Link
          href="/quick-entry"
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          + New Invoice / Receivable
        </Link>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Outstanding
          </div>
          <div className="text-lg sm:text-xl font-black text-white">
            ₹{formatINR(summary.totalReceivables.getDecimal())}
          </div>
          <div className="text-[10px] text-slate-500">
            {summary.totalCount} invoices total
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-amber-500/20 bg-amber-500/5 space-y-1">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Due Today
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-300">
            ₹{formatINR(summary.dueTodayAmount.getDecimal())}
          </div>
          <div className="text-[10px] text-amber-400/70">
            {summary.dueTodayCount} due today
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-rose-500/20 bg-rose-500/5 space-y-1">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-300">
            ₹{formatINR(summary.overdueAmount.getDecimal())}
          </div>
          <div className="text-[10px] text-rose-400/70">
            {summary.overdueCount} overdue invoices
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-blue-500/20 bg-blue-500/5 space-y-1">
          <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
            Partially Paid
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-300">
            ₹{formatINR(summary.partiallyPaidAmount.getDecimal())}
          </div>
          <div className="text-[10px] text-blue-400/70">
            {summary.partiallyPaidCount} active partials
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Collected
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-400">
            ₹{formatINR(summary.totalPaidAmount.getDecimal())}
          </div>
          <div className="text-[10px] text-slate-500">
            from ₹{formatINR(summary.totalOriginalAmount.getDecimal())} billed
          </div>
        </div>
      </div>

      {/* Aging Analysis Bar */}
      <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-orange-400" />
            Receivable Aging Schedule
          </span>
          <span className="text-slate-400 text-[11px]">
            Total: ₹{formatINR(aging.total.getDecimal())}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Current</div>
            <div className="text-xs font-bold text-white mt-1">₹{formatINR(aging.current.amount.getDecimal())}</div>
            <div className="text-[10px] text-slate-500">{aging.current.count} inv ({aging.current.percentage}%)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-yellow-400 font-bold uppercase">1–30 Days</div>
            <div className="text-xs font-bold text-white mt-1">₹{formatINR(aging.days1To30.amount.getDecimal())}</div>
            <div className="text-[10px] text-slate-500">{aging.days1To30.count} inv ({aging.days1To30.percentage}%)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-amber-400 font-bold uppercase">31–60 Days</div>
            <div className="text-xs font-bold text-white mt-1">₹{formatINR(aging.days31To60.amount.getDecimal())}</div>
            <div className="text-[10px] text-slate-500">{aging.days31To60.count} inv ({aging.days31To60.percentage}%)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-orange-400 font-bold uppercase">61–90 Days</div>
            <div className="text-xs font-bold text-white mt-1">₹{formatINR(aging.days61To90.amount.getDecimal())}</div>
            <div className="text-[10px] text-slate-500">{aging.days61To90.count} inv ({aging.days61To90.percentage}%)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/20 bg-rose-500/5 col-span-2 sm:col-span-1">
            <div className="text-[10px] text-rose-400 font-bold uppercase">90+ Days</div>
            <div className="text-xs font-bold text-rose-300 mt-1">₹{formatINR(aging.days90Plus.amount.getDecimal())}</div>
            <div className="text-[10px] text-rose-400/70">{aging.days90Plus.count} inv ({aging.days90Plus.percentage}%)</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl glass-card border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, invoice #, reference, title..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "All" },
            { id: "UNPAID", label: "Unpaid" },
            { id: "PARTIAL", label: "Partially Paid" },
            { id: "OVERDUE", label: "Overdue" },
            { id: "PAID", label: "Paid" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Receivables List / Cards */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-xl">
            🧾
          </div>
          <h3 className="text-sm font-bold text-white">No Receivables Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || statusFilter !== "ALL"
              ? "No invoices match your current search and status filters."
              : "No receivable invoices have been posted yet. Create an invoice to track payments."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const numOutstanding = parseFloat(r.outstandingAmount) || 0;
            const isSettled = numOutstanding <= 0;

            let dueLabel = "No due date";
            let dueColor = "text-slate-500";
            if (r.dueDate) {
              const d = new Date(r.dueDate);
              const daysDiff = differenceInDays(d, now);
              if (isToday(d)) {
                dueLabel = "Due Today";
                dueColor = "text-amber-400 font-bold";
              } else if (daysDiff < 0) {
                dueLabel = `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? "" : "s"}`;
                dueColor = "text-rose-400 font-bold";
              } else {
                dueLabel = `Due in ${daysDiff} day${daysDiff === 1 ? "" : "s"}`;
                dueColor = "text-slate-400";
              }
            }

            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      #{r.transactionNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        r.paymentStatus === PaymentStatus.PAID
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : r.paymentStatus === PaymentStatus.PARTIALLY_PAID
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {r.paymentStatus.replace("_", " ")}
                    </span>
                    {r.referenceNumber && (
                      <span className="text-[11px] text-slate-500">
                        Ref: {r.referenceNumber}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white truncate">{r.title}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {r.customerName && (
                      <div className="flex items-center gap-1 text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium">{r.customerName}</span>
                        {r.customerId && (
                          <Link
                            href={`/customers/${r.customerId}/ledger`}
                            className="text-[11px] text-orange-400 hover:underline ml-1"
                          >
                            (View Ledger)
                          </Link>
                        )}
                      </div>
                    )}
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{format(new Date(r.transactionDate), "dd MMM yyyy")}</span>
                    </div>
                    <span>•</span>
                    <span className={dueColor}>{dueLabel}</span>
                  </div>
                </div>

                {/* Right Amounts & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                  <div className="text-left md:text-right space-y-0.5">
                    <div className="text-xs text-slate-400">
                      Total: ₹{formatINR(r.totalAmount)}
                    </div>
                    <div className="text-base font-black text-white">
                      Due: ₹{formatINR(r.outstandingAmount)}
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      Paid: ₹{formatINR(r.paidAmount)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSettled && (
                      <button
                        onClick={() => handleOpenPayment(r)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-all shrink-0"
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        Receive Payment
                      </button>
                    )}

                    <Link
                      href={`/records/${r.id}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                      title="View Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receive Payment Modal */}
      {selectedReceivable && (
        <ReceivePaymentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          direction={PaymentDirection.IN}
          transaction={{
            id: selectedReceivable.id,
            transactionNumber: selectedReceivable.transactionNumber,
            title: selectedReceivable.title,
            totalAmount: selectedReceivable.totalAmount,
            paidAmount: selectedReceivable.paidAmount,
            outstandingAmount: selectedReceivable.outstandingAmount,
            partyId: selectedReceivable.customerId,
            partyName: selectedReceivable.customerName,
          }}
          paymentMethods={paymentMethods}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
