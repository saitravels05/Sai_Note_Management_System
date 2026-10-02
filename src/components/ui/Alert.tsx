import React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({ variant = "info", title, children, onClose, className }: AlertProps) {
  const styles = {
    info: {
      border: "border-cyan-500/30",
      bg: "bg-cyan-500/10",
      text: "text-cyan-300",
      icon: Info,
    },
    success: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      icon: CheckCircle2,
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      icon: AlertTriangle,
    },
    error: {
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      text: "text-rose-300",
      icon: AlertCircle,
    },
  };

  const current = styles[variant];
  const Icon = current.icon;

  return (
    <div
      role="alert"
      className={cn(
        "p-4 rounded-xl border flex items-start gap-3 text-xs",
        current.bg,
        current.border,
        className
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", current.text)} />
      <div className="flex-1 space-y-0.5">
        {title && <div className={cn("font-bold", current.text)}>{title}</div>}
        <div className="text-slate-300">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss alert"
          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
