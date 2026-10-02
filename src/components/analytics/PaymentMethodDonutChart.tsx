"use client";

import { formatINR } from "@/lib/formatters";
import { CreditCard, Wallet, Smartphone, Building2 } from "lucide-react";
import { type PaymentMethodAnalysisItem } from "@/server/services/analytics.service";
import { PaymentMethodType } from "@prisma/client";

interface PaymentMethodDonutChartProps {
  methods: PaymentMethodAnalysisItem[];
}

export function PaymentMethodDonutChart({ methods }: PaymentMethodDonutChartProps) {
  const getIcon = (type: PaymentMethodType) => {
    switch (type) {
      case PaymentMethodType.UPI:
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case PaymentMethodType.BANK_TRANSFER:
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case PaymentMethodType.CASH:
        return <Wallet className="w-4 h-4 text-amber-400" />;
      default:
        return <CreditCard className="w-4 h-4 text-purple-400" />;
    }
  };

  const getColor = (type: PaymentMethodType) => {
    switch (type) {
      case PaymentMethodType.UPI:
        return "#10B981"; // emerald
      case PaymentMethodType.BANK_TRANSFER:
        return "#3B82F6"; // blue
      case PaymentMethodType.CASH:
        return "#F59E0B"; // amber
      default:
        return "#8B5CF6"; // purple
    }
  };

  const totalInflows = methods.reduce((acc, m) => acc + parseFloat(m.inflow), 0);

  // Calculate SVG stroke dashes for donut segments
  const strokeRadius = 40;
  const circumference = 2 * Math.PI * strokeRadius; // ~251.32

  const activeMethods = methods.filter((m) => m.percentageOfInflows > 0);
  const segments = activeMethods.map((m, idx) => {
    const priorPercent = activeMethods
      .slice(0, idx)
      .reduce((sum, item) => sum + item.percentageOfInflows, 0);
    const strokeDash = (m.percentageOfInflows / 100) * circumference;
    const strokeOffset = circumference - (priorPercent / 100) * circumference;
    return {
      ...m,
      strokeDash,
      strokeOffset,
      color: getColor(m.type),
    };
  });

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-400" />
            Payment Methods & Collections
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Share of incoming settlements across payment channels
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* SVG Donut */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r={strokeRadius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="12"
            />
            {/* Segments */}
            {segments.map((seg) => (
              <circle
                key={seg.id}
                cx="50"
                cy="50"
                r={strokeRadius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${seg.strokeDash} ${circumference}`}
                strokeDashoffset={seg.strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            ))}
          </svg>

          {/* Center Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Inflows
            </span>
            <span className="text-sm font-black text-white">
              ₹{formatINR(totalInflows)}
            </span>
          </div>
        </div>

        {/* Method Breakdown List */}
        <div className="md:col-span-7 space-y-3">
          {methods.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800">
                  {getIcon(m.type)}
                </div>
                <div>
                  <div className="font-bold text-white">{m.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {m.count} payments • In: ₹{formatINR(m.inflow)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-bold text-orange-400">
                  {m.percentageOfInflows}%
                </div>
                <div className="text-[10px] text-slate-400">
                  Net: ₹{formatINR(m.netFlow)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
