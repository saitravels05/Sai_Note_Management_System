import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "brand" | "income" | "expense" | "receivable" | "payable" | "neutral";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "neutral",
  className,
}: StatCardProps) {
  const borderVariants = {
    brand: "border-orange-500/25",
    income: "border-emerald-500/25",
    expense: "border-rose-500/25",
    receivable: "border-cyan-500/25",
    payable: "border-amber-500/25",
    neutral: "border-slate-800",
  };

  const iconBgVariants = {
    brand: "bg-orange-500/10 text-orange-400",
    income: "bg-emerald-500/10 text-emerald-400",
    expense: "bg-rose-500/10 text-rose-400",
    receivable: "bg-cyan-500/10 text-cyan-400",
    payable: "bg-amber-500/10 text-amber-400",
    neutral: "bg-slate-800 text-slate-400",
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl glass-card border relative overflow-hidden transition-all",
        borderVariants[variant],
        className
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-400">
        <span>{title}</span>
        {Icon && (
          <span className={cn("p-1.5 rounded-lg", iconBgVariants[variant])}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold text-white tracking-tight">{value}</div>
      {subtitle && <div className="mt-1 text-[11px] text-slate-400">{subtitle}</div>}
    </div>
  );
}
