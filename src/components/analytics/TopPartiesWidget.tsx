"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { Users, ArrowUpRight } from "lucide-react";
import { type PartySummaryItem } from "@/server/services/analytics.service";

interface TopPartiesWidgetProps {
  customers: PartySummaryItem[];
  suppliers: PartySummaryItem[];
}

export function TopPartiesWidget({ customers, suppliers }: TopPartiesWidgetProps) {
  const [tab, setTab] = useState<"CUSTOMERS" | "SUPPLIERS">("CUSTOMERS");

  const parties = tab === "CUSTOMERS" ? customers : suppliers;
  const isCustomer = tab === "CUSTOMERS";

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-400" />
            Key Business Counterparties
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Top customer revenue volume and supplier liabilities
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs self-start">
          <button
            onClick={() => setTab("CUSTOMERS")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              isCustomer
                ? "bg-orange-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Top Customers
          </button>
          <button
            onClick={() => setTab("SUPPLIERS")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              !isCustomer
                ? "bg-orange-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Top Suppliers
          </button>
        </div>
      </div>

      {/* List */}
      {parties.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No {isCustomer ? "customer" : "supplier"} activity found.
        </div>
      ) : (
        <div className="space-y-3">
          {parties.map((p) => {
            const ledgerHref = isCustomer
              ? `/customers/${p.id}/ledger`
              : `/suppliers/${p.id}/ledger`;

            const numOutstanding = parseFloat(p.outstanding) || 0;

            return (
              <div
                key={p.id}
                className="group p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                      {p.code}
                    </span>
                    <span className="font-bold text-white group-hover:text-orange-400 transition-colors">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {p.count} transactions • Total Volume: ₹{formatINR(p.totalBilled)}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">
                      {isCustomer ? "Customer Owes" : "You Owe"}
                    </div>
                    <div
                      className={`font-black ${
                        numOutstanding > 0 ? "text-orange-400" : "text-emerald-400"
                      }`}
                    >
                      ₹{formatINR(p.outstanding)}
                    </div>
                  </div>

                  <Link
                    href={ledgerHref}
                    title="Open chronological statement ledger"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors"
                  >
                    <span>Ledger</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
