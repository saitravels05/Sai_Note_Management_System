import Link from "next/link";
import { ShieldX, ArrowLeft, LogIn } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen w-full bg-[#070b12] text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden">
      <div className="w-full max-w-md bg-[#0e1422]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          You do not have permission to access this section of the accounting system. If you believe this is an error, please contact your business administrator or owner.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-sm font-medium transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In with Different Account</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
