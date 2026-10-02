import { Users, PlusCircle } from "lucide-react";

export default function PartiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Directory & Ledgers
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Customers & Suppliers</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Party contact directory, running account balances, and individual ledger histories.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-orange-700 transition-all self-start sm:self-center">
          <PlusCircle className="w-4 h-4" />
          + Add Party
        </button>
      </div>

      <div className="p-8 rounded-2xl glass-card border border-slate-800 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Party Directory Empty</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Parties are automatically added when you record transactions or can be created manually with opening balances.
        </p>
      </div>
    </div>
  );
}
