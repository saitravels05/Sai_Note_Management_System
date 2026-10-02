"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building,
  Phone,
  Mail,
} from "lucide-react";
import { QuickExportModal } from "@/components/exports/QuickExportModal";

export interface SerializedLedgerEntry {
  id: string;
  date: string;
  entityNumber: string;
  referenceNumber: string | null;
  description: string;
  type: "TRANSACTION" | "PAYMENT" | "ADJUSTMENT";
  rawType: string;
  debit: string;
  credit: string;
  runningBalance: string;
  status: string;
}

interface PartyLedgerViewProps {
  partyType: "CUSTOMER" | "SUPPLIER";
  party: {
    id: string;
    name: string;
    code: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  };
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  totalOutstanding: string;
  entries: SerializedLedgerEntry[];
}

export function PartyLedgerView({
  partyType,
  party,
  openingBalance,
  totalDebits,
  totalCredits,
  closingBalance,
  totalOutstanding,
  entries,
}: PartyLedgerViewProps) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const isCustomer = partyType === "CUSTOMER";

  const filteredEntries = entries.filter((e) => {
    if (filterType === "INVOICES") {
      return e.rawType === "RECEIVABLE" || e.rawType === "PAYABLE";
    }
    if (filterType === "PAYMENTS") {
      return e.rawType === "PAYMENT_IN" || e.rawType === "PAYMENT_OUT" || e.type === "PAYMENT";
    }
    return true;
  });

  const numClosing = parseFloat(closingBalance) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={isCustomer ? "/customers" : "/suppliers"}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                {party.code}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {party.name}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Official Account Statement & Chronological Activity Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomer ? (
            <Link
              href="/receivables"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Receivables
            </Link>
          ) : (
            <Link
              href="/payables"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Payables
            </Link>
          )}

          <QuickExportModal
            buttonText="Export Statement"
            defaultExportType={isCustomer ? "CUSTOMER_LEDGER" : "SUPPLIER_LEDGER"}
            allowedTypes={[
              {
                value: isCustomer ? "CUSTOMER_LEDGER" : "SUPPLIER_LEDGER",
                label: `${isCustomer ? "Customer" : "Supplier"} Account Statement`,
                description: "Chronological ledger with debits, credits, and verified running balance.",
              },
            ]}
            partyId={party.id}
            buttonClassName="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all"
          />

          <Link
            href={`/quick-entry?${isCustomer ? "customerId" : "supplierId"}=${party.id}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-600/20 transition-all"
          >
            + Add Entry
          </Link>
        </div>
      </div>

      {/* Party Info Bar */}
      <div className="p-4 rounded-2xl glass-card border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-400">
          {party.companyName && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Building className="w-4 h-4 text-slate-500" />
              <span>{party.companyName}</span>
            </div>
          )}
          {party.phone && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>{party.phone}</span>
            </div>
          )}
          {party.email && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>{party.email}</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
          Sign Rule:{" "}
          {isCustomer
            ? "Debit (+) = Invoice, Credit (-) = Paid"
            : "Credit (+) = Billed, Debit (-) = Paid"}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Opening Balance
          </div>
          <div className="text-lg font-black text-white">
            ₹{formatINR(openingBalance)}
          </div>
          <div className="text-[10px] text-slate-500">Prior Period Base</div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCustomer ? "Total Invoiced (Debit)" : "Total Paid (Debit)"}
          </div>
          <div className="text-lg font-black text-slate-200">
            ₹{formatINR(totalDebits)}
          </div>
          <div className="text-[10px] text-slate-500">
            {isCustomer ? "Billed to customer" : "Disbursed to supplier"}
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCustomer ? "Total Paid (Credit)" : "Total Billed (Credit)"}
          </div>
          <div className="text-lg font-black text-slate-200">
            ₹{formatINR(totalCredits)}
          </div>
          <div className="text-[10px] text-slate-500">
            {isCustomer ? "Collected payments" : "Incurred bills"}
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl glass-card border space-y-1 ${
            numClosing > 0
              ? "border-orange-500/20 bg-orange-500/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
            Current Balance
          </div>
          <div className="text-lg font-black text-white">
            ₹{formatINR(closingBalance)}
          </div>
          <div className="text-[10px] text-slate-400">
            {isCustomer
              ? numClosing > 0
                ? `Customer owes ₹${formatINR(totalOutstanding)} outstanding`
                : "Account fully settled"
              : numClosing > 0
              ? `You owe ₹${formatINR(totalOutstanding)} outstanding`
              : "Account fully settled"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl glass-card border border-slate-800">
        <div className="flex items-center gap-1">
          {[
            { id: "ALL", label: "All Activity" },
            { id: "INVOICES", label: isCustomer ? "Invoices Only" : "Bills Only" },
            { id: "PAYMENTS", label: "Payments Only" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterType === tab.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredEntries.length} statement entries
        </div>
      </div>

      {/* Statement Table */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-card border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h3 className="text-sm font-bold text-white">No Ledger Entries Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No transactions or payments have been recorded for this party. Add an invoice or payment to begin statement history.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0e1422] shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference / #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit (₹)</th>
                <th className="px-4 py-3 text-right">Credit (₹)</th>
                <th className="px-4 py-3 text-right font-bold text-white">Balance (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredEntries.map((row) => {
                const numDebit = parseFloat(row.debit) || 0;
                const numCredit = parseFloat(row.credit) || 0;

                return (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                      {format(new Date(row.date), "dd MMM yyyy")}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-orange-400">
                      {row.type === "TRANSACTION" ? (
                        <Link href={`/records/${row.id}`} className="hover:underline">
                          #{row.entityNumber}
                        </Link>
                      ) : (
                        <span>#{row.entityNumber}</span>
                      )}
                      {row.referenceNumber && (
                        <span className="block text-[10px] text-slate-500 font-sans">
                          {row.referenceNumber}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          row.rawType.includes("PAYMENT")
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        }`}
                      >
                        {row.rawType.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                      {row.description}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {numDebit > 0 ? formatINR(row.debit) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {numCredit > 0 ? formatINR(row.credit) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      ₹{formatINR(row.runningBalance)}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
