import { Building2, Tag } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              System Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Application Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure business identity, custom operational fields, and accounting defaults.
          </p>
        </div>
      </div>

      {/* Business Details */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Building2 className="w-4 h-4 text-orange-400" />
          Business Profile
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium">Business / Agency Name</label>
            <input
              type="text"
              defaultValue="Sai Tours & Travels"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium">GSTIN (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 33AAAAA0000A1Z5"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium">Default Currency</label>
            <input
              type="text"
              disabled
              defaultValue="INR (₹) - Indian Rupee"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium">Accounting Timezone</label>
            <input
              type="text"
              disabled
              defaultValue="Asia/Kolkata (IST)"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Custom Fields Section */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Tag className="w-4 h-4 text-orange-400" />
            Custom Fields Engine
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30">
            + Define Custom Field
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Create custom fields (e.g. Flight PNR, Passport Number, Hotel Voucher ID, Driver Contact) that appear dynamically in your record cards without code changes.
        </p>
      </div>
    </div>
  );
}
