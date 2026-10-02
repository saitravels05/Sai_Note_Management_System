"use client";

import { Sparkles, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { type CalculatedInsight } from "@/server/services/analytics.service";

interface CalculatedInsightsCardProps {
  insights: CalculatedInsight[];
}

export function CalculatedInsightsCard({ insights }: CalculatedInsightsCardProps) {
  const getIcon = (type: CalculatedInsight["type"]) => {
    switch (type) {
      case "POSITIVE":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "INFO":
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCardStyle = (type: CalculatedInsight["type"]) => {
    switch (type) {
      case "POSITIVE":
        return "border-emerald-500/20 bg-emerald-950/10";
      case "WARNING":
        return "border-amber-500/20 bg-amber-950/10";
      case "INFO":
      default:
        return "border-blue-500/20 bg-blue-950/10";
    }
  };

  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Calculated Insights</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                Rule-Based Engine (Non-AI)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic observations derived directly from verified accounting totals
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {insights.map((ins) => (
          <div
            key={ins.id}
            className={`p-4 rounded-xl border ${getCardStyle(ins.type)} space-y-1.5 transition-all`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getIcon(ins.type)}
                <span className="text-xs font-bold text-white">{ins.title}</span>
              </div>
              {ins.metric && (
                <span className="text-xs font-mono font-black text-white px-1.5 py-0.5 bg-slate-900/90 rounded border border-slate-700/60">
                  {ins.metric}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{ins.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
