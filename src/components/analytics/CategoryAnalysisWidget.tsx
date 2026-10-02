"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { PieChart, ArrowUpRight } from "lucide-react";
import { type CategoryAnalysisItem } from "@/server/services/analytics.service";

interface CategoryAnalysisWidgetProps {
  incomeCategories: CategoryAnalysisItem[];
  expenseCategories: CategoryAnalysisItem[];
}

export function CategoryAnalysisWidget({
  incomeCategories,
  expenseCategories,
}: CategoryAnalysisWidgetProps) {
  const [tab, setTab] = useState<"EXPENSES" | "INCOME">("EXPENSES");

  const categories = tab === "EXPENSES" ? expenseCategories : incomeCategories;
  const isExpense = tab === "EXPENSES";

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-orange-400" />
            Category Distribution
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational spending and revenue stream breakdown
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs self-start">
          <button
            onClick={() => setTab("EXPENSES")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              isExpense
                ? "bg-rose-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Expenses by Category
          </button>
          <button
            onClick={() => setTab("INCOME")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              !isExpense
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Income by Category
          </button>
        </div>
      </div>

      {/* Category List */}
      {categories.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No {isExpense ? "expense" : "income"} records found for this period.
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="group p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 transition-all space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white group-hover:text-orange-400 transition-colors">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({cat.count} records)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-black text-white">
                    ₹{formatINR(cat.amount)}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-orange-400">
                    {cat.percentage}%
                  </span>
                  <Link
                    href={`/records?categoryId=${cat.id}&type=${isExpense ? "EXPENSE" : "INCOME"}`}
                    title={`Drill down into ${cat.name} records`}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isExpense ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
