import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      <div className="text-xs font-semibold text-slate-400">Loading accounting ledger...</div>
    </div>
  );
}
