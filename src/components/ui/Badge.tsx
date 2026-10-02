import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "income" | "expense" | "pending" | "brand" | "neutral" | "outline";
}

export function Badge({ className, variant = "neutral", children, ...props }: BadgeProps) {
  const variants = {
    income: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    expense: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    pending: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    brand: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    neutral: "bg-slate-800 text-slate-300 border border-slate-700",
    outline: "border border-slate-700 text-slate-400 bg-transparent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
